import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
  }),
  z.object({
    action: z.literal("override"),
    newPartnerId: z.string().uuid("newPartnerId must be a valid UUID"),
    reason: z.string().min(3, "Reason must be at least 3 characters"),
  }),
  z.object({
    action: z.literal("dismiss"),
  }),
]);

async function requireAdminOrStaff() {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin, userId: user.id };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) return auth.error;

    const { admin, userId } = auth;
    const { id } = await params;

    const body = patchSchema.parse(await request.json());

    // Load the current decision so we can snapshot previous values for the
    // override log and validate the record exists.
    const { data: decision, error: fetchError } = await admin
      .from("automation_decisions")
      .select(
        "id, status, recommended_priority, recommended_owner_id, recommended_stream, recommendation_json",
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!decision) {
      return NextResponse.json(
        { error: "Routing recommendation not found." },
        { status: 404 },
      );
    }

    // ── Accept ──────────────────────────────────────────────────────────────
    if (body.action === "accept") {
      const { error } = await admin
        .from("automation_decisions")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id, status: "accepted" });
    }

    // ── Override ─────────────────────────────────────────────────────────────
    if (body.action === "override") {
      // Verify the new partner exists and is active.
      const { data: newPartner, error: partnerError } = await admin
        .from("service_partners")
        .select("id, name, package_stream")
        .eq("id", body.newPartnerId)
        .eq("is_active", true)
        .maybeSingle();

      if (partnerError || !newPartner) {
        return NextResponse.json(
          { error: "Selected partner not found or inactive." },
          { status: 400 },
        );
      }

      // Partner IDs live in recommendation_json (recommended_owner_id is an
      // auth.users FK and must stay null for partner-based routing).
      const prevJson =
        typeof decision.recommendation_json === "object" &&
        decision.recommendation_json !== null
          ? (decision.recommendation_json as Record<string, unknown>)
          : {};

      const updatedJson: Record<string, unknown> = {
        ...prevJson,
        partner_id: body.newPartnerId,
        partner_name: newPartner.name,
        override_previous_partner_id: prevJson.partner_id ?? null,
        override_previous_partner_name: prevJson.partner_name ?? null,
      };

      // Update the decision: new partner in recommendation_json + overridden status.
      const { error: updateError } = await admin
        .from("automation_decisions")
        .update({
          status: "overridden",
          recommendation_json: updatedJson,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      // Write override audit record.
      const { error: overrideError } = await admin
        .from("automation_overrides")
        .insert({
          decision_id: id,
          overridden_by: userId,
          // previous_owner_id / new_owner_id reference auth.users — leave null.
          previous_owner_id: null,
          new_owner_id: null,
          reason: body.reason,
          metadata: {
            previous_partner_id: prevJson.partner_id ?? null,
            previous_partner_name: prevJson.partner_name ?? null,
            new_partner_id: body.newPartnerId,
            new_partner_name: newPartner.name,
            stream: decision.recommended_stream,
          },
        });

      if (overrideError) {
        // Non-fatal: decision is already updated; log and continue.
        console.error(
          "[routing-recommendations] Failed to write override audit:",
          overrideError.message,
        );
      }

      return NextResponse.json({
        id,
        status: "overridden",
        newPartnerId: body.newPartnerId,
        newPartnerName: newPartner.name,
      });
    }

    // ── Dismiss ───────────────────────────────────────────────────────────────
    if (body.action === "dismiss") {
      const { error } = await admin
        .from("automation_decisions")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id, status: "dismissed" });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update routing recommendation.",
      },
      { status: 500 },
    );
  }
}

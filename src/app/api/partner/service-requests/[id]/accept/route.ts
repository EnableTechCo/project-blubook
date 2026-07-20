import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requirePartnerUser() {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "partner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, userId: user.id };
}

// Moves a claimed request from "submitted" to "in_progress" — the partner
// explicitly starting work, distinct from claiming ownership. Guarded to
// the caller's own claimed requests and the submitted status only, so this
// can't be used to skip straight to in_progress on someone else's request
// or re-accept an already-started one.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePartnerUser();
    if ("error" in auth) return auth.error;

    const { admin, userId } = auth;
    const { id } = await params;

    const { data, error } = await admin
      .from("service_requests")
      .update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("partner_id", userId)
      .eq("status", "submitted")
      .select("id, status")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Could not accept this request — it may not be claimed by you or has already moved past submitted.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ id: data.id, status: data.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not accept request.",
      },
      { status: 500 },
    );
  }
}

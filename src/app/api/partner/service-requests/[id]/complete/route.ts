import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertNotifications } from "@/lib/workflow/order-lifecycle";

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

// Moves a request from "in_progress" to "completed" -- the partner marking
// their work finished. Guarded to the caller's own claimed requests and the
// in_progress status only, so this can't be used to complete someone else's
// request or skip straight from submitted without ever being accepted.
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
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("partner_id", userId)
      .eq("status", "in_progress")
      .select("id, status, title, customer_id, organization_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Could not complete this request — it may not be claimed by you or is not currently in progress.",
        },
        { status: 409 },
      );
    }

    if (data.customer_id && data.organization_id) {
      try {
        await insertNotifications(admin, [
          {
            userId: data.customer_id,
            organizationId: data.organization_id,
            message: `Your service request "${data.title}" has been completed.`,
            metadata: {
              source: "service_request_status_change",
              service_request_id: data.id,
              status: "completed",
            },
          },
        ]);
      } catch (notifyError) {
        // Notification failure should not undo the complete action.
        console.error("Failed to notify customer of request completion:", notifyError);
      }
    }

    return NextResponse.json({ id: data.id, status: data.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete request.",
      },
      { status: 500 },
    );
  }
}

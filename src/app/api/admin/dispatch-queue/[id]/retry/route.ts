import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdminOrStaff() {
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

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin };
}

// Manually re-queues a permanently failed event, resetting its retry budget.
// Distinct from the automatic backoff retry in the engine — this is an
// explicit human override after investigating the failure.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const { id } = await params;

    const { data, error } = await admin
      .from("workflow_events_queue")
      .update({
        status: "queued",
        retry_count: 0,
        next_retry_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "failed")
      .select("id, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Event not found or is not in a failed state." },
        { status: 404 },
      );
    }

    return NextResponse.json({ id: data.id, status: data.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not retry event.",
      },
      { status: 500 },
    );
  }
}

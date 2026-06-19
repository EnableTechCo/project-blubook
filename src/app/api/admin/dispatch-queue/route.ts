import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type QueueItemRow = {
  id: string;
  event_type: string;
  status: string;
  scheduled_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
};

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

  return { admin };
}

async function countByStatus(
  admin: ReturnType<typeof createAdminClient>,
  status: string,
) {
  const { count, error } = await admin
    .from("workflow_events_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) return auth.error;

    const statusFilterParam = new URL(request.url).searchParams
      .get("status")
      ?.trim()
      .toLowerCase();

    let rowsQuery = auth.admin
      .from("workflow_events_queue")
      .select(
        "id, event_type, status, scheduled_at, processed_at, created_at, updated_at, error_message",
      )
      .order("created_at", { ascending: false });

    if (statusFilterParam) {
      rowsQuery = rowsQuery.eq("status", statusFilterParam.toLowerCase());
    }

    const { data: rows, error: rowsError } = await rowsQuery.limit(100);

    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 400 });
    }

    const [queued, processing, completed, failed] = await Promise.all([
      countByStatus(auth.admin, "queued"),
      countByStatus(auth.admin, "processing"),
      countByStatus(auth.admin, "completed"),
      countByStatus(auth.admin, "failed"),
    ]);

    return NextResponse.json({
      metrics: {
        queued,
        processing,
        completed,
        failed,
      },
      events: (rows ?? []) as QueueItemRow[],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load dispatch queue.",
      },
      { status: 500 },
    );
  }
}

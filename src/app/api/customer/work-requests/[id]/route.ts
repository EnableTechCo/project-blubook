import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkRequestTimeline } from "@/services/work-request-timeline.service";

// The customer's anonymized view of one request's progress (Phase 4, P4-4).
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const admin = createAdminClient();

    const result = await getWorkRequestTimeline(admin, {
      workRequestId: id,
      customerId: user.id,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.timeline);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load this request.",
      },
      { status: 500 },
    );
  }
}

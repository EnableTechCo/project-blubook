import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchReadyItems } from "@/services/work-order-dispatch.service";

// Dispatch a work request's released items to providers (Phase 3, P3-3).
//
// Idempotent: only `ready` items are placed, and each flips to `assigned` as it
// goes, so re-running dispatches nothing twice. Items that could not be placed
// come back in `unplaced` rather than failing the request.
export async function POST(
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
    const result = await dispatchReadyItems(admin, { workRequestId: id });

    return NextResponse.json({
      dispatchedCount: result.dispatched.length,
      unplacedCount: result.unplaced.length,
      dispatched: result.dispatched,
      unplaced: result.unplaced,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not dispatch the work request.",
      },
      { status: 500 },
    );
  }
}

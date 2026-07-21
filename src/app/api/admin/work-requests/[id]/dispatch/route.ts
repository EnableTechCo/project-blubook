import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/require-admin";
import { dispatchReadyItems } from "@/services/work-order-dispatch.service";

// Dispatch a work request's released items to providers (Phase 3, P3-3).
//
// Admin/staff only: dispatching assigns work to providers and notifies them,
// so it must not be callable by any authenticated user.
//
// Idempotent: only `ready` items are placed, and each flips to `assigned` as it
// goes, so re-running dispatches nothing twice. Items that could not be placed
// come back in `unplaced` rather than failing the request.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;

    const { id } = await context.params;
    const result = await dispatchReadyItems(guard.admin, { workRequestId: id });

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

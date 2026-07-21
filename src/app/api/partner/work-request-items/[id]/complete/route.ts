import { NextResponse } from "next/server";
import { completeWorkOrderItem } from "@/services/work-order-completion.service";
import {
  isProviderContextError,
  resolveProviderContext,
} from "../../partner-auth";

// A provider marks one assigned work order complete (Phase 3, P3-4).
//
// Completing an item advances its request: anything whose prerequisites are
// now satisfied is released and dispatched, and the parent closes when the
// last item finishes.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const provider = await resolveProviderContext();
    if (isProviderContextError(provider)) {
      return NextResponse.json(
        { error: provider.error },
        { status: provider.status },
      );
    }

    const { id } = await context.params;
    const result = await completeWorkOrderItem(provider.admin, {
      workRequestItemId: id,
      expectedProviderId: provider.providerId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      status: "completed",
      workRequestId: result.workRequestId,
      queuedForRetry: result.queuedForRetry,
      released: result.advance?.releasedItemIds.length ?? 0,
      dispatched: result.advance?.dispatchedCount ?? 0,
      requestCompleted: result.advance?.requestCompleted ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete the work order.",
      },
      { status: 500 },
    );
  }
}

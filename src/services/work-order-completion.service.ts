import type { AppSupabaseClient as SupabaseClient } from "@/lib/supabase/types";
import {
  evaluateRelease,
  type ReleaseDependency,
  type ReleaseItem,
  type WorkRequestItemStatus,
} from "@/features/catalog/release-evaluation";
import { dispatchReadyItems } from "@/services/work-order-dispatch.service";
import { queueWorkflowEvent } from "@/lib/workflow/engine";
import { notifyCustomer } from "@/services/work-request-notifications.service";

// Work-order completion + release loop (Phase 3, P3-4)
//
// Closes the gated-release cycle. When a provider finishes an item, the
// request is re-evaluated (P3-2): anything whose prerequisites are now all
// complete flips to `ready` and is immediately dispatched (P3-3). When the
// last item finishes, the parent is closed and a completion event emitted.
//
// The advance step is deliberately separate from the "mark complete" step so
// the queue handler can re-run it safely: re-evaluating a request that has
// nothing to release is a no-op, which makes retries harmless.

export interface AdvanceResult {
  releasedItemIds: string[];
  dispatchedCount: number;
  unplacedCount: number;
  requestCompleted: boolean;
}

/** Load the item statuses and instance edges the release rule needs. */
async function loadGraph(
  admin: SupabaseClient,
  workRequestId: string,
): Promise<{ items: ReleaseItem[]; dependencies: ReleaseDependency[] }> {
  const { data: itemRows, error: itemsError } = await admin
    .from("work_request_items")
    .select("id, status")
    .eq("work_request_id", workRequestId);
  if (itemsError) throw new Error(itemsError.message);

  const items: ReleaseItem[] = (
    (itemRows ?? []) as Array<{ id: string; status: string }>
  ).map((r) => ({ id: r.id, status: r.status as WorkRequestItemStatus }));

  if (items.length === 0) return { items, dependencies: [] };

  const { data: depRows, error: depsError } = await admin
    .from("work_request_item_dependencies")
    .select("work_request_item_id, depends_on_item_id")
    .in(
      "work_request_item_id",
      items.map((i) => i.id),
    );
  if (depsError) throw new Error(depsError.message);

  const dependencies: ReleaseDependency[] = (
    (depRows ?? []) as Array<{
      work_request_item_id: string;
      depends_on_item_id: string;
    }>
  ).map((r) => ({
    workRequestItemId: r.work_request_item_id,
    dependsOnItemId: r.depends_on_item_id,
  }));

  return { items, dependencies };
}

/**
 * Re-evaluate a work request, release what has earned it, and dispatch.
 *
 * Idempotent: with nothing newly releasable this only re-runs dispatch, which
 * is itself a no-op when no item is `ready`.
 */
export async function advanceWorkRequest(
  admin: SupabaseClient,
  input: { workRequestId: string },
): Promise<AdvanceResult> {
  const { items, dependencies } = await loadGraph(admin, input.workRequestId);
  const evaluation = evaluateRelease(items, dependencies);

  // Flip newly-unblocked items to ready. The status guard keeps a concurrent
  // run from releasing the same item twice.
  if (evaluation.releasableIds.length > 0) {
    const { error } = await admin
      .from("work_request_items")
      .update({ status: "ready" })
      .in("id", evaluation.releasableIds)
      .eq("status", "blocked");
    if (error) throw new Error(error.message);
  }

  const dispatch = await dispatchReadyItems(admin, {
    workRequestId: input.workRequestId,
  });

  // Every item done — close the parent and announce it.
  let requestCompleted = false;
  if (evaluation.allComplete) {
    const { error } = await admin
      .from("work_requests")
      .update({ status: "completed" })
      .eq("id", input.workRequestId)
      .neq("status", "completed"); // only the run that closes it emits
    if (error) throw new Error(error.message);

    requestCompleted = true;
    await notifyCustomer(admin, {
      workRequestId: input.workRequestId,
      event: "work_request_completed",
    });
  }

  return {
    releasedItemIds: evaluation.releasableIds,
    dispatchedCount: dispatch.dispatched.length,
    unplacedCount: dispatch.unplaced.length,
    requestCompleted,
  };
}

export interface CompleteItemSuccess {
  ok: true;
  workRequestId: string;
  /** Null when the advance failed and was handed to the queue to retry. */
  advance: AdvanceResult | null;
  queuedForRetry: boolean;
}

export interface CompleteItemFailure {
  ok: false;
  error: string;
  status: number;
}

export type CompleteItemResult = CompleteItemSuccess | CompleteItemFailure;

/**
 * Mark one work order complete and advance its request.
 *
 * `expectedProviderId` scopes the update to the assigned provider so one
 * provider cannot complete another's work.
 */
export async function completeWorkOrderItem(
  admin: SupabaseClient,
  input: { workRequestItemId: string; expectedProviderId?: string },
): Promise<CompleteItemResult> {
  const { data: item, error } = await admin
    .from("work_request_items")
    // The label comes along on this read so announcing the completion costs no
    // extra round-trip.
    .select("id, work_request_id, status, assigned_provider_id, catalog_items(label)")
    .eq("id", input.workRequestItemId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 500 };
  if (!item) return { ok: false, error: "Work order not found.", status: 404 };

  if (
    input.expectedProviderId &&
    item.assigned_provider_id !== input.expectedProviderId
  ) {
    return {
      ok: false,
      error: "This work order is not assigned to you.",
      status: 403,
    };
  }

  if (item.status === "completed") {
    return { ok: false, error: "This work order is already complete.", status: 409 };
  }
  if (item.status === "blocked" || item.status === "ready") {
    return {
      ok: false,
      error: "This work order has not been started yet.",
      status: 409,
    };
  }

  const { error: updateError } = await admin
    .from("work_request_items")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", input.workRequestItemId)
    .neq("status", "completed");
  if (updateError) {
    return { ok: false, error: updateError.message, status: 500 };
  }

  // Announce the finished item before advancing, so the customer sees it
  // complete even if the release step below fails and is retried.
  const label = (item as { catalog_items?: { label?: string } | null })
    .catalog_items?.label;
  await notifyCustomer(admin, {
    workRequestId: item.work_request_id,
    event: "work_order_completed",
    workRequestItemId: input.workRequestItemId,
    label,
  });

  // Advance inline so the release loop moves immediately: nothing drains the
  // workflow queue on a timer, so relying on the event alone would leave the
  // next layer blocked until someone triggered the dispatcher. The queued
  // event is the durable fallback if this attempt fails — advancing is
  // idempotent, so the retry cannot double-release or double-dispatch.
  try {
    const advance = await advanceWorkRequest(admin, {
      workRequestId: item.work_request_id,
    });
    return {
      ok: true,
      workRequestId: item.work_request_id,
      advance,
      queuedForRetry: false,
    };
  } catch (err) {
    console.error(
      "[work-order-completion] Inline advance failed, queueing retry:",
      err instanceof Error ? err.message : err,
    );
    try {
      await queueWorkflowEvent("work_request.item_completed", {
        workRequestId: item.work_request_id,
        workRequestItemId: input.workRequestItemId,
      });
    } catch (queueErr) {
      console.error(
        "[work-order-completion] Failed to queue advance retry:",
        queueErr instanceof Error ? queueErr.message : queueErr,
      );
    }
    return {
      ok: true,
      workRequestId: item.work_request_id,
      advance: null,
      queuedForRetry: true,
    };
  }
}

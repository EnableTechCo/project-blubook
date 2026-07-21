import { createAdminClient } from "@/lib/supabase/admin";
import { requireJsonString } from "@/lib/supabase/json";
import type {
  WorkflowEventType,
  WorkflowPayload,
  WorkRequestWorkflowEventType,
} from "@/lib/workflow/types";

// Work-request workflow events (Phase 3, P3-4)
//
// Only the release-loop retry remains queued. Completing an item advances its
// request inline (P3-4); this handler exists so that if the inline advance
// throws, the work is picked up on the next queue drain.
//
// Notifications are NOT queued. They were, until P4-3 found that a queue with
// no scheduler never delivers them — the customer and provider notices now
// emit inline from the services, through the anonymity boundary (P4-2).

export function isWorkRequestWorkflowEvent(
  eventType: WorkflowEventType,
): eventType is WorkRequestWorkflowEventType {
  return eventType === "work_request.item_completed";
}

export async function processWorkRequestWorkflowEvent(
  eventType: WorkRequestWorkflowEventType,
  payload: WorkflowPayload,
) {
  if (eventType !== "work_request.item_completed") return;

  const workRequestId = requireJsonString(payload, "workRequestId");
  const admin = createAdminClient();
  // Imported lazily to break the cycle: engine -> this module -> completion
  // service -> engine (for queueWorkflowEvent).
  const { advanceWorkRequest } = await import(
    "@/services/work-order-completion.service"
  );
  await advanceWorkRequest(admin, { workRequestId });
}

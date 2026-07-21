import { createAdminClient } from "@/lib/supabase/admin";
import { requireJsonString } from "@/lib/supabase/json";
import {
  insertNotifications,
  resolveCustomerUserIds,
  resolvePartnerUserIds,
} from "@/lib/workflow/order-lifecycle";
import type {
  WorkflowEventType,
  WorkflowPayload,
  WorkRequestWorkflowEventType,
} from "@/lib/workflow/types";

// Work-request workflow events (Phase 3, P3-3 / P3-4)
//
// Side-effects for the work-order lifecycle:
//   item_dispatched — tell the assigned provider they have work
//   item_completed  — re-run the release loop so the next layer unblocks
//   completed       — tell the customer their whole request is done
//
// Both directions stay anonymous: the provider is told what work they have and
// which service it belongs to, never who the customer is; the customer is told
// their request progressed, never which provider did it. The full mediation
// rules land with the notification layer in Phase 4.

const WORK_REQUEST_EVENTS: WorkRequestWorkflowEventType[] = [
  "work_request.item_dispatched",
  "work_request.item_completed",
  "work_request.completed",
];

export function isWorkRequestWorkflowEvent(
  eventType: WorkflowEventType,
): eventType is WorkRequestWorkflowEventType {
  return (WORK_REQUEST_EVENTS as string[]).includes(eventType);
}

export async function processWorkRequestWorkflowEvent(
  eventType: WorkRequestWorkflowEventType,
  payload: WorkflowPayload,
) {
  if (eventType === "work_request.item_completed") {
    return processItemCompleted(payload);
  }
  if (eventType === "work_request.completed") {
    return processRequestCompleted(payload);
  }
  return processItemDispatched(eventType, payload);
}

/**
 * Re-run the release loop after an item finishes. Idempotent — advancing a
 * request with nothing newly releasable does nothing, so a retry is harmless.
 */
async function processItemCompleted(payload: WorkflowPayload) {
  const workRequestId = requireJsonString(payload, "workRequestId");
  const admin = createAdminClient();
  // Imported lazily to break the cycle: engine -> this module -> completion
  // service -> engine (for queueWorkflowEvent).
  const { advanceWorkRequest } = await import(
    "@/services/work-order-completion.service"
  );
  await advanceWorkRequest(admin, { workRequestId });
}

/** Tell the customer their request is complete — without naming any provider. */
async function processRequestCompleted(payload: WorkflowPayload) {
  const workRequestId = requireJsonString(payload, "workRequestId");
  const admin = createAdminClient();

  const { data: request, error } = await admin
    .from("work_requests")
    .select("id, organization_id")
    .eq("id", workRequestId)
    .single();

  if (error || !request) {
    throw new Error(`Work request ${workRequestId} not found: ${error?.message}`);
  }
  if (!request.organization_id) return;

  const customerUserIds = await resolveCustomerUserIds(
    admin,
    request.organization_id,
  );

  await insertNotifications(
    admin,
    customerUserIds.map((userId) => ({
      userId,
      organizationId: request.organization_id,
      message: "All work orders in your request are complete.",
      metadata: {
        source: "work_request_workflow_event",
        event_type: "work_request.completed",
        work_request_id: workRequestId,
      },
    })),
  );
}

async function processItemDispatched(
  eventType: WorkRequestWorkflowEventType,
  payload: WorkflowPayload,
) {
  const workRequestItemId = requireJsonString(payload, "workRequestItemId");
  const providerId = requireJsonString(payload, "providerId");

  const admin = createAdminClient();

  const { data: item, error } = await admin
    .from("work_request_items")
    .select("id, catalog_item_id, service_id")
    .eq("id", workRequestItemId)
    .single();

  if (error || !item) {
    throw new Error(
      `Work request item ${workRequestItemId} not found: ${error?.message}`,
    );
  }

  const [labelRes, serviceRes] = await Promise.all([
    admin
      .from("catalog_items")
      .select("label")
      .eq("id", item.catalog_item_id)
      .maybeSingle(),
    admin
      .from("services")
      .select("name")
      .eq("id", item.service_id)
      .maybeSingle(),
  ]);

  const label = labelRes.data?.label ?? "A work order";
  const serviceName = serviceRes.data?.name ?? "your service";

  const partnerUserIds = await resolvePartnerUserIds(admin, [providerId]);
  if (partnerUserIds.length === 0) return;

  await insertNotifications(
    admin,
    partnerUserIds.map((userId) => ({
      userId,
      organizationId: null,
      message: `New ${serviceName} work order assigned to you: ${label}.`,
      metadata: {
        source: "work_request_workflow_event",
        event_type: eventType,
        work_request_item_id: workRequestItemId,
      },
    })),
  );
}

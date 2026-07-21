import { createAdminClient } from "@/lib/supabase/admin";
import { requireJsonString } from "@/lib/supabase/json";
import {
  insertNotifications,
  resolvePartnerUserIds,
} from "@/lib/workflow/order-lifecycle";
import type {
  WorkflowEventType,
  WorkflowPayload,
  WorkRequestWorkflowEventType,
} from "@/lib/workflow/types";

// Work-request workflow events (Phase 3, P3-3)
//
// Dispatch side-effects for work-order items. The assignment itself is written
// synchronously by the dispatch service; this handler carries the news to the
// provider so a queue hiccup can never leave an item assigned-but-unannounced.
//
// The provider is told what work they have and which service it belongs to —
// never who the customer is. Customer-side messaging and the full mediation
// rules land with the notification layer in Phase 4.

export function isWorkRequestWorkflowEvent(
  eventType: WorkflowEventType,
): eventType is WorkRequestWorkflowEventType {
  return eventType === "work_request.item_dispatched";
}

export async function processWorkRequestWorkflowEvent(
  eventType: WorkRequestWorkflowEventType,
  payload: WorkflowPayload,
) {
  if (eventType !== "work_request.item_dispatched") return;

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

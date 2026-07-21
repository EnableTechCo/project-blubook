import type { JsonObject } from "@/lib/supabase/json";

export type SalesWorkflowEventType =
  | "order.created"
  | "order.validated"
  | "order.routed"
  | "task.started"
  | "task.completed"
  | "order.packaged";

export type LogisticsWorkflowEventType =
  | "logistics.handoff_created"
  | "logistics.order_received"
  | "logistics.warehouse_transmitted"
  | "logistics.customer_notified"
  | "logistics.items_packed"
  | "logistics.shipping_label_generated"
  | "order.shipped"
  | "logistics.reroute_delivery"
  | "logistics.reroute_complete"
  | "logistics.order_arrived"
  | "logistics.pod_signed"
  | "logistics.system_updated"
  | "order.delivered";

export type RequestWorkflowEventType =
  | "request.acknowledged"
  | "request.rejected";

// Only the advance-retry fallback remains queued. The dispatch and completion
// notices were queue-only and therefore never delivered — nothing drains the
// queue on a timer — so P4-3 emits those inline instead.
export type WorkRequestWorkflowEventType = "work_request.item_completed";

export type WorkflowEventType =
  | SalesWorkflowEventType
  | LogisticsWorkflowEventType
  | RequestWorkflowEventType
  | WorkRequestWorkflowEventType;

export type WorkflowPayload = JsonObject;

export type QueueWorkflowEvent = (
  eventType: WorkflowEventType,
  payload: WorkflowPayload,
) => Promise<string>;

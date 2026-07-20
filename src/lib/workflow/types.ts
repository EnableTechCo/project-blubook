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

export type WorkflowEventType =
  | SalesWorkflowEventType
  | LogisticsWorkflowEventType
  | RequestWorkflowEventType;

export type WorkflowPayload = Record<string, unknown>;

export type QueueWorkflowEvent = (
  eventType: WorkflowEventType,
  payload: WorkflowPayload,
) => Promise<string>;

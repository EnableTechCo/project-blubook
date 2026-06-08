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
  | "order.shipped"
  | "order.delivered";

export type WorkflowEventType =
  | SalesWorkflowEventType
  | LogisticsWorkflowEventType;

export type WorkflowPayload = Record<string, unknown>;

export type QueueWorkflowEvent = (
  eventType: WorkflowEventType,
  payload: WorkflowPayload,
) => Promise<string>;

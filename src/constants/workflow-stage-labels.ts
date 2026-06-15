export type WorkflowStageKey =
  | "po_submitted"
  | "sales_validated"
  | "inventory_reserved"
  | "handoff_created"
  | "handoff_confirmed"
  | "logistics_active"
  | "in_transit"
  | "order_arrived"
  | "pod_signed"
  | "system_updated"
  | "delivered";

export type SalesWorkflowStageKey =
  | "po_submitted"
  | "sales_validated"
  | "inventory_reserved"
  | "handoff_created"
  | "handoff_confirmed"
  | "logistics_active"
  | "in_transit"
  | "order_arrived"
  | "pod_signed"
  | "system_updated"
  | "delivered";

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStageKey, string> = {
  po_submitted: "PO Submitted",
  sales_validated: "Sales Validated",
  inventory_reserved: "Inventory Reserved",
  handoff_created: "Handoff Created (Sales Confirmed PO)",
  handoff_confirmed: "Handoff Confirmed (Logistics Accepted)",
  logistics_active: "Logistics Active",
  in_transit: "In Transit",
  order_arrived: "Arrived",
  pod_signed: "POD Signed",
  system_updated: "System Updated",
  delivered: "Delivered",
};

export const SALES_WORKFLOW_STAGE_LABELS: Record<
  SalesWorkflowStageKey,
  string
> = {
  po_submitted: "PO Submitted",
  sales_validated: "Sales Validated",
  inventory_reserved: "Inventory Reserved",
  handoff_created: "Handoff Created (Sales Confirmed PO)",
  handoff_confirmed: "Handoff Confirmed (Logistics Accepted)",
  logistics_active: "Logistics Active",
  in_transit: "In Transit",
  order_arrived: "Arrived",
  pod_signed: "POD Signed",
  system_updated: "System Updated",
  delivered: "Delivered",
};

export const WORKFLOW_ACTION_LABELS = {
  salesConfirmReceipt: SALES_WORKFLOW_STAGE_LABELS.sales_validated,
  logisticsConfirmHandoff: SALES_WORKFLOW_STAGE_LABELS.handoff_confirmed,
  logisticsActivate: "Start Warehouse Processing",
  logisticsDeliver: "Complete Delivery Step",
} as const;

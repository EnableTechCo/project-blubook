export const SALES_WORKFLOW_STATES = [
  "Purchase Order Received",
  "Order Validated",
  "Inventory Reserved",
  "Work Order Created",
  "Pick Ticket Generated",
  "Manufacturing",
  "Packaging",
  "Invoice Generated",
  "Shipment Created",
  "Delivered",
] as const;

export const LOGISTICS_WORKFLOW_STATES = [
  "Order Received",
  "Warehouse Processing",
  "Carrier Assigned",
  "In Transit",
  "Out for Delivery",
  "Delivered",
] as const;

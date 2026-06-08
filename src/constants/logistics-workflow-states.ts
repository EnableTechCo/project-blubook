export const LOGISTICS_WORKFLOW_STATES = [
  "Order Received",
  "Order Transmitted to Warehouse",
  "Notify Customer",
  "Pack Items for Shipment",
  "Generate Shipping Label & Documentation",
  "Track Shipment In Transit",
  "Reroute Delivery",
  "Order Arrives at Destination",
  "Customer Receives & Signs POD",
  "BluBook System Updated",
  "Delivered",
] as const;

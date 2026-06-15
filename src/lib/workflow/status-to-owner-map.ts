export const STATUS_TO_OWNER_MAP: Record<
  string,
  { owner: string; next: string }
> = {
  "Purchase Order Received": {
    owner: "Sales",
    next: "Sales to validate your PO.",
  },
  "Order Validated": { owner: "Sales", next: "Sales reserving inventory." },
  "Inventory Reserved": {
    owner: "Sales",
    next: "Sales creating logistics handoff.",
  },
  "Logistics Handoff Created": {
    owner: "Sales",
    next: "Sales generating invoice.",
  },
  "Invoice Generated": { owner: "Sales", next: "Sales confirming shipment." },
  "Shipment Created": {
    owner: "Logistics",
    next: "Logistics acknowledging intake.",
  },
  "Order Received": {
    owner: "Logistics",
    next: "Logistics transmitting to warehouse.",
  },
  "Order Transmitted to Warehouse": {
    owner: "Logistics",
    next: "Logistics notifying you.",
  },
  "Notify Customer": {
    owner: "Logistics",
    next: "Logistics packing your items.",
  },
  "Pack Items for Shipment": {
    owner: "Logistics",
    next: "Logistics generating shipping label.",
  },
  "Generate Shipping Label & Documentation": {
    owner: "Logistics",
    next: "Logistics dispatching shipment.",
  },
  "Track Shipment In Transit": {
    owner: "Logistics",
    next: "Shipment in transit - awaiting arrival.",
  },
  "Reroute Delivery": {
    owner: "Logistics",
    next: "Delivery issue being resolved.",
  },
  "Order Arrives at Destination": {
    owner: "Logistics",
    next: "Awaiting your POD signature.",
  },
  "Customer Receives & Signs POD": {
    owner: "You + Logistics",
    next: "POD signed - logistics updating system.",
  },
  "BluBook System Updated": {
    owner: "Logistics",
    next: "Final delivery confirmation pending.",
  },
  Delivered: { owner: "Complete", next: "Order delivered." },
};

export function getOwnerForStatus(status: string | null | undefined) {
  return (
    STATUS_TO_OWNER_MAP[status ?? ""] ?? {
      owner: "Processing",
      next: "Workflow is advancing.",
    }
  );
}

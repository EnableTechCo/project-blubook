import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function SalesInventoryPage() {
  return (
    <PhaseWorkspace
      phase="Phase 3"
      title="Inventory"
      subtitle="Allocation views to support order reservation and fulfillment planning."
      metrics={[
        { label: "SKUs", value: "318", hint: "Catalog coverage" },
        { label: "Reserved", value: "126", hint: "Allocated units" },
        { label: "Low Stock", value: "9", hint: "Procurement trigger" },
        { label: "Backorder", value: "4", hint: "Needs supplier" },
      ]}
      streams={[
        {
          title: "Allocation Stream",
          items: [
            "Reserve stock per order state",
            "Manage pick-ticket commitments",
            "Release stock on cancellation events",
          ],
        },
        {
          title: "Planning Stream",
          items: [
            "Demand trend monitoring",
            "Supplier replenishment planning",
            "Threshold-driven low-stock alerts",
          ],
        },
      ]}
    />
  );
}

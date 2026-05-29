import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function LogisticsDeliveryPage() {
  return (
    <PhaseWorkspace
      phase="Phase 3"
      title="Delivery"
      subtitle="Delivery confirmations, proof-of-delivery uploads and exception workflows."
      metrics={[
        { label: "Delivered Today", value: "47", hint: "Confirmed drop-offs" },
        { label: "POD Received", value: "43", hint: "Proof artifacts" },
        { label: "Failed", value: "2", hint: "Retry required" },
        { label: "Awaiting POD", value: "4", hint: "Pending upload" },
      ]}
      streams={[
        {
          title: "Confirmation Stream",
          items: [
            "Capture delivery time and geodata",
            "Store recipient acknowledgement",
            "Close shipment on validation",
          ],
        },
        {
          title: "Exception Stream",
          items: [
            "Route failed attempts to support",
            "Plan re-delivery operations",
            "Notify customers and partners",
          ],
        },
      ]}
    />
  );
}

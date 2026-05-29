import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { LOGISTICS_WORKFLOW_STATES } from "@/constants/workflow-states";

export default function LogisticsShipmentsPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase="Phase 3"
        title="Shipments"
        subtitle="Manage shipment lifecycle from warehouse processing to delivery completion."
        metrics={[
          { label: "Created", value: "31", hint: "Dispatch queue" },
          { label: "In Transit", value: "18", hint: "Active movement" },
          { label: "Delivered", value: "12", hint: "Closed shipments" },
          { label: "Exceptions", value: "1", hint: "Delayed or failed" },
        ]}
        streams={[
          {
            title: "Dispatch Stream",
            items: [
              "Warehouse routing and wave planning",
              "Carrier assignment and manifesting",
              "Shipment status event publication",
            ],
          },
          {
            title: "Proof Stream",
            items: [
              "Delivery confirmation capture",
              "Proof-of-delivery artifact upload",
              "Exception route to support desk",
            ],
          },
        ]}
      />
      <WorkflowPipeline
        title="Logistics Lifecycle"
        states={LOGISTICS_WORKFLOW_STATES}
      />
    </div>
  );
}

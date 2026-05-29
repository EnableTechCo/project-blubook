import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { SALES_WORKFLOW_STATES } from "@/constants/workflow-states";

export default function SalesWorkOrdersPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase="Phase 3"
        title="Sales Work Orders"
        subtitle="Generate and manage work orders with manufacturing and packaging states."
        metrics={[
          { label: "Generated", value: "34", hint: "From validated orders" },
          { label: "Manufacturing", value: "14", hint: "Active production" },
          { label: "Packaging", value: "8", hint: "Ready to dispatch" },
          { label: "Blocked", value: "2", hint: "Needs intervention" },
        ]}
        streams={[
          {
            title: "Production Stream",
            items: [
              "Queue orders into manufacturing",
              "Track output and quality gates",
              "Route to packaging and dispatch",
            ],
          },
          {
            title: "Control Stream",
            items: [
              "Assign partner execution owners",
              "Raise blockers and remediation tasks",
              "Publish completion events to billing",
            ],
          },
        ]}
      />
      <WorkflowPipeline
        title="Work-Order Lifecycle"
        states={SALES_WORKFLOW_STATES}
      />
    </div>
  );
}

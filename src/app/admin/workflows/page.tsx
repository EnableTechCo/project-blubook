import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import {
  LOGISTICS_WORKFLOW_STATES,
  SALES_WORKFLOW_STATES,
} from "@/constants/workflow-states";

export default function AdminWorkflowsPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase="Phase 4"
        title="Workflow Configuration"
        subtitle="Configure sales, logistics and request state machines with guardrails."
        metrics={[
          { label: "Active Workflows", value: "9", hint: "Published models" },
          { label: "Automations", value: "31", hint: "Event rules" },
          { label: "Versions", value: "22", hint: "Historical revisions" },
          { label: "Rollbacks", value: "1", hint: "Last 90 days" },
        ]}
        streams={[
          {
            title: "Design Stream",
            items: [
              "State transition modeling",
              "Guard condition configuration",
              "Notification and side-effect rules",
            ],
          },
          {
            title: "Release Stream",
            items: [
              "Versioned publish process",
              "Impact simulation before deploy",
              "Rollback and hotfix controls",
            ],
          },
        ]}
      />
      <WorkflowPipeline title="Sales Workflow" states={SALES_WORKFLOW_STATES} />
      <WorkflowPipeline
        title="Logistics Workflow"
        states={LOGISTICS_WORKFLOW_STATES}
      />
    </div>
  );
}

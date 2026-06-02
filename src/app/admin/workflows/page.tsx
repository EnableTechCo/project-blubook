import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import {
  LOGISTICS_WORKFLOW_STATES,
  SALES_WORKFLOW_STATES,
} from "@/constants/workflow-states";
import { MOCK_ADMIN_WORKFLOWS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function AdminWorkflowsPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase={MOCK_ADMIN_WORKFLOWS_WORKSPACE.phase}
        title={MOCK_ADMIN_WORKFLOWS_WORKSPACE.title}
        subtitle={MOCK_ADMIN_WORKFLOWS_WORKSPACE.subtitle}
        metrics={MOCK_ADMIN_WORKFLOWS_WORKSPACE.metrics}
        streams={MOCK_ADMIN_WORKFLOWS_WORKSPACE.streams}
      />
      <WorkflowPipeline title="Sales Workflow" states={SALES_WORKFLOW_STATES} />
      <WorkflowPipeline
        title="Logistics Workflow"
        states={LOGISTICS_WORKFLOW_STATES}
      />
    </div>
  );
}

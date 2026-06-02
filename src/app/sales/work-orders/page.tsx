import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { SALES_WORKFLOW_STATES } from "@/constants/workflow-states";
import { MOCK_SALES_WORK_ORDERS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function SalesWorkOrdersPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase={MOCK_SALES_WORK_ORDERS_WORKSPACE.phase}
        title={MOCK_SALES_WORK_ORDERS_WORKSPACE.title}
        subtitle={MOCK_SALES_WORK_ORDERS_WORKSPACE.subtitle}
        metrics={MOCK_SALES_WORK_ORDERS_WORKSPACE.metrics}
        streams={MOCK_SALES_WORK_ORDERS_WORKSPACE.streams}
      />
      <WorkflowPipeline
        title="Work-Order Lifecycle"
        states={SALES_WORKFLOW_STATES}
      />
    </div>
  );
}

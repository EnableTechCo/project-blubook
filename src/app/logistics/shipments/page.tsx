import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { LOGISTICS_WORKFLOW_STATES } from "@/constants/logistics-workflow-states";
import { MOCK_LOGISTICS_SHIPMENTS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function LogisticsShipmentsPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase={MOCK_LOGISTICS_SHIPMENTS_WORKSPACE.phase}
        title={MOCK_LOGISTICS_SHIPMENTS_WORKSPACE.title}
        subtitle={MOCK_LOGISTICS_SHIPMENTS_WORKSPACE.subtitle}
        metrics={MOCK_LOGISTICS_SHIPMENTS_WORKSPACE.metrics}
        streams={MOCK_LOGISTICS_SHIPMENTS_WORKSPACE.streams}
      />
      <WorkflowPipeline
        title="Logistics Lifecycle"
        states={LOGISTICS_WORKFLOW_STATES}
      />
    </div>
  );
}

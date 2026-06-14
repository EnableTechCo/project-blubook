import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WORKSPACE_CONTENT } from "@/constants/workspace-content";
import { SalesWorkOrdersClient } from "./sales-work-orders-client";

export default function SalesWorkOrdersPage() {
  const workspace = WORKSPACE_CONTENT.salesWorkOrders;

  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase={workspace.phase}
        title={workspace.title}
        subtitle={workspace.subtitle}
        metrics={workspace.metrics}
        streams={workspace.streams}
      />
      <SalesWorkOrdersClient />
    </div>
  );
}

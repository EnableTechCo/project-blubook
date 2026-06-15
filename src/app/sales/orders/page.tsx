import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WORKSPACE_CONTENT } from "@/constants/workspace-content";
import { SalesOrdersClient } from "./sales-orders-client";

export default function SalesOrdersPage() {
  const workspace = WORKSPACE_CONTENT.salesOrders;

  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase={workspace.phase}
        title={workspace.title}
        subtitle={workspace.subtitle}
        metrics={workspace.metrics}
        streams={workspace.streams}
      />
      <SalesOrdersClient />
    </div>
  );
}

import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_SALES_ORDERS_WORKSPACE } from "@/features/mock/dashboard-data";
import { SalesOrdersClient } from "./sales-orders-client";

export default function SalesOrdersPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase={MOCK_SALES_ORDERS_WORKSPACE.phase}
        title={MOCK_SALES_ORDERS_WORKSPACE.title}
        subtitle={MOCK_SALES_ORDERS_WORKSPACE.subtitle}
        metrics={MOCK_SALES_ORDERS_WORKSPACE.metrics}
        streams={MOCK_SALES_ORDERS_WORKSPACE.streams}
      />
      <SalesOrdersClient />
    </div>
  );
}


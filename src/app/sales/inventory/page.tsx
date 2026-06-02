import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_SALES_INVENTORY_WORKSPACE } from "@/features/mock/dashboard-data";

export default function SalesInventoryPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_SALES_INVENTORY_WORKSPACE.phase}
      title={MOCK_SALES_INVENTORY_WORKSPACE.title}
      subtitle={MOCK_SALES_INVENTORY_WORKSPACE.subtitle}
      metrics={MOCK_SALES_INVENTORY_WORKSPACE.metrics}
      streams={MOCK_SALES_INVENTORY_WORKSPACE.streams}
    />
  );
}

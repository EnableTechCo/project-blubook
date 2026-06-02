import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_LOGISTICS_DELIVERY_WORKSPACE } from "@/features/mock/dashboard-data";

export default function LogisticsDeliveryPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_LOGISTICS_DELIVERY_WORKSPACE.phase}
      title={MOCK_LOGISTICS_DELIVERY_WORKSPACE.title}
      subtitle={MOCK_LOGISTICS_DELIVERY_WORKSPACE.subtitle}
      metrics={MOCK_LOGISTICS_DELIVERY_WORKSPACE.metrics}
      streams={MOCK_LOGISTICS_DELIVERY_WORKSPACE.streams}
    />
  );
}

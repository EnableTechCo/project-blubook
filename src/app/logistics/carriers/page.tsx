import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_LOGISTICS_CARRIERS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function LogisticsCarriersPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_LOGISTICS_CARRIERS_WORKSPACE.phase}
      title={MOCK_LOGISTICS_CARRIERS_WORKSPACE.title}
      subtitle={MOCK_LOGISTICS_CARRIERS_WORKSPACE.subtitle}
      metrics={MOCK_LOGISTICS_CARRIERS_WORKSPACE.metrics}
      streams={MOCK_LOGISTICS_CARRIERS_WORKSPACE.streams}
    />
  );
}

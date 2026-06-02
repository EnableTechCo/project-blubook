import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_LOGISTICS_TRACKING_WORKSPACE } from "@/features/mock/dashboard-data";

export default function LogisticsTrackingPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_LOGISTICS_TRACKING_WORKSPACE.phase}
      title={MOCK_LOGISTICS_TRACKING_WORKSPACE.title}
      subtitle={MOCK_LOGISTICS_TRACKING_WORKSPACE.subtitle}
      metrics={MOCK_LOGISTICS_TRACKING_WORKSPACE.metrics}
      streams={MOCK_LOGISTICS_TRACKING_WORKSPACE.streams}
    />
  );
}

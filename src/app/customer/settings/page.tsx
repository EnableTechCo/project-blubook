import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_CUSTOMER_SETTINGS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function CustomerSettingsPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_CUSTOMER_SETTINGS_WORKSPACE.phase}
      title={MOCK_CUSTOMER_SETTINGS_WORKSPACE.title}
      subtitle={MOCK_CUSTOMER_SETTINGS_WORKSPACE.subtitle}
      metrics={MOCK_CUSTOMER_SETTINGS_WORKSPACE.metrics}
      streams={MOCK_CUSTOMER_SETTINGS_WORKSPACE.streams}
    />
  );
}

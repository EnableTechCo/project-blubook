import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_ADMIN_SETTINGS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function AdminSettingsPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_ADMIN_SETTINGS_WORKSPACE.phase}
      title={MOCK_ADMIN_SETTINGS_WORKSPACE.title}
      subtitle={MOCK_ADMIN_SETTINGS_WORKSPACE.subtitle}
      metrics={MOCK_ADMIN_SETTINGS_WORKSPACE.metrics}
      streams={MOCK_ADMIN_SETTINGS_WORKSPACE.streams}
    />
  );
}

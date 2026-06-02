import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_ADMIN_ROLES_WORKSPACE } from "@/features/mock/dashboard-data";

export default function AdminRolesPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_ADMIN_ROLES_WORKSPACE.phase}
      title={MOCK_ADMIN_ROLES_WORKSPACE.title}
      subtitle={MOCK_ADMIN_ROLES_WORKSPACE.subtitle}
      metrics={MOCK_ADMIN_ROLES_WORKSPACE.metrics}
      streams={MOCK_ADMIN_ROLES_WORKSPACE.streams}
    />
  );
}

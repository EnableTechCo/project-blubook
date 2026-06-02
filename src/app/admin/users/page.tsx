import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import {
  MOCK_ADMIN_USER_STREAMS,
  buildMockAdminUserMetrics,
} from "@/features/mock/dashboard-data";

export default function AdminUsersPage() {
  const metrics = buildMockAdminUserMetrics();

  return (
    <PhaseWorkspace
      phase="Phase 4"
      title="User Management"
      subtitle="Manage user lifecycle, onboarding status and department assignments."
      metrics={metrics}
      streams={MOCK_ADMIN_USER_STREAMS}
    />
  );
}

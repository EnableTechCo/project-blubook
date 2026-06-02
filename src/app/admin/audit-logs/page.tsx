import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_ADMIN_AUDIT_LOGS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function AdminAuditLogsPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_ADMIN_AUDIT_LOGS_WORKSPACE.phase}
      title={MOCK_ADMIN_AUDIT_LOGS_WORKSPACE.title}
      subtitle={MOCK_ADMIN_AUDIT_LOGS_WORKSPACE.subtitle}
      metrics={MOCK_ADMIN_AUDIT_LOGS_WORKSPACE.metrics}
      streams={MOCK_ADMIN_AUDIT_LOGS_WORKSPACE.streams}
    />
  );
}

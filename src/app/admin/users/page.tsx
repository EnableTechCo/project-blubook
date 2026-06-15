import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WORKSPACE_CONTENT } from "@/constants/workspace-content";

export default function AdminUsersPage() {
  const workspace = WORKSPACE_CONTENT.adminUsers;

  return (
    <PhaseWorkspace
      phase={workspace.phase}
      title={workspace.title}
      subtitle={workspace.subtitle}
      metrics={workspace.metrics}
      streams={workspace.streams}
    />
  );
}

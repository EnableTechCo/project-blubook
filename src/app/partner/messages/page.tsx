import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_PARTNER_MESSAGES_WORKSPACE } from "@/features/mock/dashboard-data";

export default function PartnerMessagesPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_PARTNER_MESSAGES_WORKSPACE.phase}
      title={MOCK_PARTNER_MESSAGES_WORKSPACE.title}
      subtitle={MOCK_PARTNER_MESSAGES_WORKSPACE.subtitle}
      metrics={MOCK_PARTNER_MESSAGES_WORKSPACE.metrics}
      streams={MOCK_PARTNER_MESSAGES_WORKSPACE.streams}
    />
  );
}

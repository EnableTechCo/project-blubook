import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_PARTNER_WORK_ORDERS_WORKSPACE } from "@/features/mock/dashboard-data";

export default function PartnerWorkOrdersPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_PARTNER_WORK_ORDERS_WORKSPACE.phase}
      title={MOCK_PARTNER_WORK_ORDERS_WORKSPACE.title}
      subtitle={MOCK_PARTNER_WORK_ORDERS_WORKSPACE.subtitle}
      metrics={MOCK_PARTNER_WORK_ORDERS_WORKSPACE.metrics}
      streams={MOCK_PARTNER_WORK_ORDERS_WORKSPACE.streams}
    />
  );
}

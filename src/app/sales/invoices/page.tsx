import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { MOCK_SALES_INVOICES_WORKSPACE } from "@/features/mock/dashboard-data";

export default function SalesInvoicesPage() {
  return (
    <PhaseWorkspace
      phase={MOCK_SALES_INVOICES_WORKSPACE.phase}
      title={MOCK_SALES_INVOICES_WORKSPACE.title}
      subtitle={MOCK_SALES_INVOICES_WORKSPACE.subtitle}
      metrics={MOCK_SALES_INVOICES_WORKSPACE.metrics}
      streams={MOCK_SALES_INVOICES_WORKSPACE.streams}
    />
  );
}

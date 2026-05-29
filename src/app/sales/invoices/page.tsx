import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function SalesInvoicesPage() {
  return (
    <PhaseWorkspace
      phase="Phase 3"
      title="Sales Invoices"
      subtitle="Invoice generation, billing workflows and payment status lifecycle."
      metrics={[
        { label: "Generated", value: "52", hint: "Current month" },
        { label: "Outstanding", value: "11", hint: "Awaiting payment" },
        { label: "Paid", value: "39", hint: "Settled invoices" },
        { label: "Overdue", value: "2", hint: "Action required" },
      ]}
      streams={[
        {
          title: "Billing Stream",
          items: [
            "Generate invoice from completed workflow",
            "Attach billing documents and delivery proofs",
            "Track payment terms and due windows",
          ],
        },
        {
          title: "Collections Stream",
          items: [
            "Auto-reminders for due invoices",
            "Escalate overdue accounts",
            "Reconcile receipts into reporting",
          ],
        },
      ]}
    />
  );
}

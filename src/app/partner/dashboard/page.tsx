import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function PartnerDashboardPage() {
  return (
    <PhaseWorkspace
      phase="Phase 2"
      title="Partner Dashboard"
      subtitle="Assigned workload visibility, SLA risk indicators and logistics progress snapshots."
      metrics={[
        { label: "Assigned", value: "24", hint: "Current queue" },
        { label: "In Progress", value: "9", hint: "Active execution" },
        { label: "SLA Risk", value: "3", hint: "Needs escalation" },
        { label: "Delivered", value: "41", hint: "Last 30 days" },
      ]}
      streams={[
        {
          title: "Execution Stream",
          items: [
            "Accept/reject work orders with audit trail",
            "Progress checkpoints with evidence",
            "Sync status back to customer requests",
          ],
        },
        {
          title: "Logistics Stream",
          items: [
            "Carrier and route updates",
            "Delivery confirmation collection",
            "Exception handling for delayed jobs",
          ],
        },
      ]}
    />
  );
}

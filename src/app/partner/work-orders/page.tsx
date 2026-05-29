import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function PartnerWorkOrdersPage() {
  return (
    <PhaseWorkspace
      phase="Phase 2"
      title="Partner Work Orders"
      subtitle="Accept, reject and progress assigned operations with completion evidence."
      metrics={[
        { label: "Pending Accept", value: "5", hint: "Requires decision" },
        { label: "Accepted", value: "17", hint: "Committed work" },
        { label: "Completed", value: "64", hint: "Historical throughput" },
        { label: "Rejected", value: "2", hint: "Escalated to ops" },
      ]}
      streams={[
        {
          title: "Lifecycle",
          items: [
            "Accept/reject SLA-bound assignments",
            "Update progress milestones",
            "Submit completion evidence and close",
          ],
        },
        {
          title: "Integration",
          items: [
            "Sync state to service_requests",
            "Trigger logistics handoff events",
            "Emit customer-facing notifications",
          ],
        },
      ]}
    />
  );
}

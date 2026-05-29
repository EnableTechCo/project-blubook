import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function LogisticsTrackingPage() {
  return (
    <PhaseWorkspace
      phase="Phase 3"
      title="Tracking"
      subtitle="Live tracking updates with realtime status broadcasts and milestone timeline."
      metrics={[
        { label: "Live Feeds", value: "18", hint: "Open channels" },
        { label: "Milestones", value: "126", hint: "Events today" },
        { label: "Delayed", value: "2", hint: "Attention needed" },
        { label: "Recovered", value: "5", hint: "Resolved delays" },
      ]}
      streams={[
        {
          title: "Signal Stream",
          items: [
            "Realtime carrier status subscriptions",
            "Milestone sequencing and deduplication",
            "Route ETA drift detection",
          ],
        },
        {
          title: "Escalation Stream",
          items: [
            "Delay threshold alerts",
            "Customer and ops notification fanout",
            "Incident correlation with audit trail",
          ],
        },
      ]}
    />
  );
}

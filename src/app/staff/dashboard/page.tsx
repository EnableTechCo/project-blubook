import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function StaffDashboardPage() {
  return (
    <PhaseWorkspace
      phase="Phase 3"
      title="Staff Operations Dashboard"
      subtitle="Cross-functional visibility for sales, engineering, logistics and support teams."
      metrics={[
        { label: "Open Incidents", value: "7", hint: "Cross-team blockers" },
        { label: "Orders Today", value: "36", hint: "Validated intake" },
        { label: "Shipments Active", value: "22", hint: "In transit" },
        { label: "SLA Breaches", value: "1", hint: "Needs action" },
      ]}
      streams={[
        {
          title: "Operations Stream",
          items: [
            "Unified workflow monitoring",
            "Escalation queue with ownership",
            "Department-filtered performance cards",
          ],
        },
        {
          title: "Coordination Stream",
          items: [
            "Sales to logistics handoff integrity",
            "Support-triggered intervention actions",
            "Daily operational digest generation",
          ],
        },
      ]}
    />
  );
}

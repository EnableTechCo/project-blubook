import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function LogisticsCarriersPage() {
  return (
    <PhaseWorkspace
      phase="Phase 3"
      title="Carriers"
      subtitle="Carrier registry, assignment rules and performance scorecards."
      metrics={[
        { label: "Active Carriers", value: "11", hint: "Integrated providers" },
        { label: "On-Time", value: "94%", hint: "Rolling 30 days" },
        { label: "Claims", value: "3", hint: "Open incidents" },
        { label: "Routes", value: "42", hint: "Assigned lanes" },
      ]}
      streams={[
        {
          title: "Registry Stream",
          items: [
            "Carrier profile lifecycle",
            "Service lane capability mapping",
            "Compliance document tracking",
          ],
        },
        {
          title: "Performance Stream",
          items: [
            "On-time and damage metrics",
            "Claims and exception analysis",
            "Automatic carrier scoring updates",
          ],
        },
      ]}
    />
  );
}

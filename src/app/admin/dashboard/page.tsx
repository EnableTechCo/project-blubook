import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function AdminDashboardPage() {
  return (
    <PhaseWorkspace
      phase="Phase 4"
      title="Admin Dashboard"
      subtitle="System-wide operational health, role distribution and policy status."
      metrics={[
        { label: "Active Users", value: "126", hint: "Signed in last 30 days" },
        { label: "Critical Alerts", value: "1", hint: "Security events" },
        { label: "Policy Drift", value: "3", hint: "Needs review" },
        { label: "Automations", value: "27", hint: "Workflow rules" },
      ]}
      streams={[
        {
          title: "Security Stream",
          items: [
            "RBAC policy health checks",
            "Auth anomaly monitoring",
            "Incident escalation controls",
          ],
        },
        {
          title: "Governance Stream",
          items: [
            "Permission model versioning",
            "System settings audit visibility",
            "Workflow policy publication",
          ],
        },
      ]}
    />
  );
}

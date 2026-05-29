import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function AdminAuditLogsPage() {
  return (
    <PhaseWorkspace
      phase="Phase 4"
      title="Audit Logs"
      subtitle="Tamper-evident activity tracking for critical actions and security events."
      metrics={[
        { label: "Events", value: "4,321", hint: "Last 30 days" },
        { label: "Critical", value: "3", hint: "Security-sensitive" },
        { label: "Exports", value: "6", hint: "Compliance pulls" },
        { label: "Retention", value: "365d", hint: "Configured policy" },
      ]}
      streams={[
        {
          title: "Traceability Stream",
          items: [
            "Actor/action/entity event capture",
            "Immutable metadata and context",
            "Correlation with workflow transitions",
          ],
        },
        {
          title: "Investigation Stream",
          items: [
            "Severity and time-range filtering",
            "Bulk export for compliance",
            "Escalation tagging and notes",
          ],
        },
      ]}
    />
  );
}

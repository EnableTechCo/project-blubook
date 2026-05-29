import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function AdminSettingsPage() {
  return (
    <PhaseWorkspace
      phase="Phase 4"
      title="System Settings"
      subtitle="Platform-level config for notifications, workflow defaults and tenant controls."
      metrics={[
        { label: "Notification Rules", value: "24", hint: "Active triggers" },
        { label: "SLA Profiles", value: "7", hint: "Department baselines" },
        { label: "Feature Flags", value: "13", hint: "Runtime toggles" },
        { label: "Tenants", value: "1", hint: "Current workspace" },
      ]}
      streams={[
        {
          title: "Configuration Stream",
          items: [
            "Notification channel defaults",
            "Workflow SLA and escalation knobs",
            "Platform behavior flags",
          ],
        },
        {
          title: "Compliance Stream",
          items: [
            "Settings version history",
            "Change approval workflow",
            "Rollback and recovery snapshots",
          ],
        },
      ]}
    />
  );
}

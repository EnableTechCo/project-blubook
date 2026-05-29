import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function CustomerSettingsPage() {
  return (
    <PhaseWorkspace
      phase="Phase 2"
      title="Customer Settings"
      subtitle="Profile, notification preferences, security controls and organization preferences."
      metrics={[
        { label: "Profiles", value: "1", hint: "Active account" },
        { label: "Channels", value: "3", hint: "In-app, Email, SMS" },
        { label: "MFA", value: "Off", hint: "Security posture" },
        { label: "Sessions", value: "2", hint: "Recent logins" },
      ]}
      streams={[
        {
          title: "Profile Controls",
          items: [
            "Update contact and company details",
            "Configure default request metadata",
            "Manage personal display preferences",
          ],
        },
        {
          title: "Security Controls",
          items: [
            "Password and MFA management",
            "Notification channel preferences",
            "Session and device revocation",
          ],
        },
      ]}
    />
  );
}

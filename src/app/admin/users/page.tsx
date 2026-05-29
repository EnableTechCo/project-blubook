import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function AdminUsersPage() {
  return (
    <PhaseWorkspace
      phase="Phase 4"
      title="User Management"
      subtitle="Manage user lifecycle, onboarding status and department assignments."
      metrics={[
        { label: "Invited", value: "14", hint: "Pending acceptance" },
        { label: "Active", value: "104", hint: "Current users" },
        { label: "Suspended", value: "3", hint: "Restricted accounts" },
        { label: "Admins", value: "6", hint: "Privileged users" },
      ]}
      streams={[
        {
          title: "Identity Stream",
          items: [
            "Invite and onboarding pipeline",
            "Role/department assignment controls",
            "Account lifecycle transitions",
          ],
        },
        {
          title: "Access Stream",
          items: [
            "Session revocation and lockouts",
            "Risk-based user reviews",
            "Auth activity inspection",
          ],
        },
      ]}
    />
  );
}

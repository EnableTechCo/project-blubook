import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function AdminRolesPage() {
  return (
    <PhaseWorkspace
      phase="Phase 4"
      title="Roles and Permissions"
      subtitle="RBAC management for customer, partner, staff and admin capabilities."
      metrics={[
        { label: "Roles", value: "12", hint: "Configured templates" },
        { label: "Permissions", value: "86", hint: "Action controls" },
        { label: "Overrides", value: "5", hint: "Custom grants" },
        { label: "Pending Review", value: "2", hint: "Policy changes" },
      ]}
      streams={[
        {
          title: "Policy Stream",
          items: [
            "Role template management",
            "Permission matrix governance",
            "Scope-based policy publication",
          ],
        },
        {
          title: "Safety Stream",
          items: [
            "Change simulation and dry-run",
            "Conflict detection on overrides",
            "Audit trail for grants and revocations",
          ],
        },
      ]}
    />
  );
}

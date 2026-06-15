import { AppShell } from "@/components/shell/app-shell";
import { staffNav } from "@/features/navigation/role-nav";
import { requireRouteAccess } from "@/lib/auth/require-route-access";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess({ allowedRoles: ["staff", "admin"] });

  return (
    <AppShell roleLabel="Staff" navItems={staffNav}>
      {children}
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/features/navigation/role-nav";
import { requireRouteAccess } from "@/lib/auth/require-route-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess({ allowedRoles: ["admin"] });

  return (
    <AppShell roleLabel="Admin" navItems={adminNav}>
      {children}
    </AppShell>
  );
}

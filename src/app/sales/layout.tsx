import { AppShell } from "@/components/shell/app-shell";
import { staffNav } from "@/features/navigation/role-nav";
import { requireRouteAccess } from "@/lib/auth/require-route-access";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess({ allowedRoles: ["staff", "admin"] });

  return (
    <AppShell roleLabel="Sales" navItems={staffNav}>
      {children}
    </AppShell>
  );
}

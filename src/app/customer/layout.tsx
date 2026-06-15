import { CustomerPortalShell } from "@/components/shell/customer-portal-shell";
import { requireRouteAccess } from "@/lib/auth/require-route-access";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess({ allowedRoles: ["customer", "admin"] });

  return <CustomerPortalShell>{children}</CustomerPortalShell>;
}

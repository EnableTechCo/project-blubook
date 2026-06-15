import { PartnerShell } from "@/components/shell/partner-shell";
import { requireRouteAccess } from "@/lib/auth/require-route-access";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRouteAccess({ allowedRoles: ["partner", "admin"] });

  return <PartnerShell>{children}</PartnerShell>;
}

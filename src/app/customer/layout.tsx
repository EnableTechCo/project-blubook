import { CustomerPortalShell } from "@/components/shell/customer-portal-shell";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CustomerPortalShell>{children}</CustomerPortalShell>;
}

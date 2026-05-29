import { AppShell } from "@/components/shell/app-shell";
import { partnerNav } from "@/features/navigation/role-nav";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell roleLabel="Partner" navItems={partnerNav}>
      {children}
    </AppShell>
  );
}

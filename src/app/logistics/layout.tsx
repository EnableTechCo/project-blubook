import { AppShell } from "@/components/shell/app-shell";
import { staffNav } from "@/features/navigation/role-nav";

export default function LogisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell roleLabel="Logistics" navItems={staffNav}>
      {children}
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { staffNav } from "@/features/navigation/role-nav";

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell roleLabel="Sales" navItems={staffNav}>
      {children}
    </AppShell>
  );
}

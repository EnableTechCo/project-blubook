import { AppShell } from "@/components/shell/app-shell";
import { customerNav } from "@/features/navigation/role-nav";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell roleLabel="Customer" navItems={customerNav}>
      {children}
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { staffNav } from "@/features/navigation/role-nav";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell roleLabel="Staff" navItems={staffNav}>
      {children}
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/features/navigation/role-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell roleLabel="Admin" navItems={adminNav}>
      {children}
    </AppShell>
  );
}

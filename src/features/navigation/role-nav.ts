import { ShellNavItem } from "@/components/shell/app-shell";

export const customerNav: ShellNavItem[] = [
  { href: "/customer/billing", label: "Billing" },
  { href: "/customer/requests", label: "Requests" },
  { href: "/customer/messages", label: "Messages" },
  { href: "/customer/documents", label: "Documents" },
  { href: "/customer/analytics", label: "Analytics" },
  { href: "/customer/settings", label: "Settings" },
];

export const partnerNav: ShellNavItem[] = [
  { href: "/partner/dashboard", label: "Dashboard" },
  { href: "/partner/inbox", label: "Inbox" },
  { href: "/partner/work-orders", label: "Work Orders" },
  { href: "/partner/messages", label: "Messages" },
  { href: "/partner/documents", label: "Documents" },
  { href: "/partner/reports", label: "Reports" },
];

export const staffNav: ShellNavItem[] = [
  { href: "/staff/dashboard", label: "Overview" },
  { href: "/sales/orders", label: "Sales Orders" },
  { href: "/sales/work-orders", label: "Sales Work Orders" },
  { href: "/sales/invoices", label: "Invoices" },
  { href: "/sales/inventory", label: "Inventory" },
  { href: "/logistics/shipments", label: "Shipments" },
  { href: "/logistics/tracking", label: "Tracking" },
  { href: "/logistics/carriers", label: "Carriers" },
  { href: "/logistics/delivery", label: "Delivery" },
];

export const adminNav: ShellNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/workflows", label: "Workflows" },
];

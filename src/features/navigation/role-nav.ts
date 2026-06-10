import type { Route } from "next";
import { ShellNavItem } from "@/components/shell/app-shell";

export const customerNav: ShellNavItem[] = [
  { href: "/customer/dashboard" as Route, label: "Dashboard" },
  { href: "/customer/billing" as Route, label: "Billing" },
  { href: "/customer/orders" as Route, label: "Orders" },
  { href: "/customer/requests" as Route, label: "Requests" },
  { href: "/customer/messages" as Route, label: "Messages" },
  { href: "/customer/documents" as Route, label: "Documents" },
  { href: "/customer/analytics" as Route, label: "Analytics" },
  { href: "/customer/settings" as Route, label: "Settings" },
];

export const partnerNav: ShellNavItem[] = [
  { href: "/partner/dashboard", label: "Dashboard" },
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
  { href: "/admin/dashboard" as Route, label: "Dashboard" },

  { href: "/admin/packages" as Route, label: "Packages" },
  { href: "/admin/services" as Route, label: "Services" },
  { href: "/admin/providers" as Route, label: "Providers" },

  { href: "/admin/clients" as Route, label: "Clients" },

  { href: "/admin/support" as Route, label: "Support" },
  { href: "/admin/reports" as Route, label: "Reports & Analytics" },

  { href: "/admin/admin-users" as Route, label: "Admin Users" },
  { href: "/admin/settings" as Route, label: "Settings" },
];

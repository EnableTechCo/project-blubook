import type { Route } from "next";
import { ShellNavItem } from "@/components/shell/app-shell";

export const customerNav: ShellNavItem[] = [
  {
    href: "/customer/dashboard" as Route,
    label: "Dashboard",
    section: "Overview",
  },
  {
    href: "/customer/analytics" as Route,
    label: "Analytics",
    section: "Overview",
  },
  { href: "/customer/orders" as Route, label: "Orders", section: "Operations" },
  {
    href: "/customer/requests" as Route,
    label: "Requests",
    section: "Operations",
  },
  {
    href: "/customer/billing" as Route,
    label: "Billing",
    section: "Operations",
  },
  {
    href: "/customer/messages" as Route,
    label: "Messages",
    section: "Communication",
  },
  {
    href: "/customer/documents" as Route,
    label: "Documents",
    section: "Documents",
  },
  {
    href: "/customer/settings" as Route,
    label: "Settings",
    section: "Account",
  },
];

export const partnerNav: ShellNavItem[] = [
  { href: "/partner/dashboard", label: "Dashboard", section: "Overview" },
  { href: "/partner/work-orders", label: "Work Orders", section: "Operations" },
  { href: "/partner/reports", label: "Reports", section: "Operations" },
  { href: "/partner/messages", label: "Messages", section: "Communication" },
  { href: "/partner/documents", label: "Documents", section: "Documents" },
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
  { href: "/admin/dashboard", label: "Overview", section: "Overview" },
  { href: "/admin/orders", label: "Orders", section: "Operations" },
  { href: "/admin/work-orders", label: "Work Orders", section: "Operations" },
  {
    href: "/admin/dispatch-queue",
    label: "Dispatch Queue",
    section: "Operations",
  },
  {
    href: "/admin/logistics-handoffs",
    label: "Logistics Handoffs",
    section: "Operations",
  },
  {
    href: "/admin/sales-pipeline",
    label: "Sales Pipeline",
    section: "Operations",
  },
  { href: "/admin/customers", label: "Customers", section: "People" },
  { href: "/admin/partners", label: "Partners", section: "People" },
  { href: "/admin/users", label: "Users", section: "People" },
  { href: "/admin/documents", label: "Documents", section: "Documents" },
  { href: "/admin/workflows", label: "Workflows", section: "System" },
  { href: "/admin/roles", label: "Roles", section: "System" },
  { href: "/admin/settings", label: "Settings", section: "System" },
  { href: "/admin/audit-logs", label: "Audit Logs", section: "System" },
];

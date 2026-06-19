"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

type CustomerRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  primaryContactEmail: string | null;
  activeOrders: number;
  completedOrders: number;
  totalOrders: number;
  lifetimeValueCents: number;
  currencyCode: string;
  lastOrderAt: string | null;
  updatedAt: string;
};

type CustomerSummary = {
  total: number;
  withActiveOrders: number;
  withNoOrders: number;
  active: number;
};

type CustomersPayload = {
  summary: CustomerSummary;
  customers: CustomerRow[];
};

function formatMoney(cents: number, currencyCode: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currencyCode || "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "active"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-300/50"
      : normalized === "inactive" || normalized === "churned"
        ? "bg-slate-400/15 text-slate-600 border-slate-300/50"
        : normalized === "suspended"
          ? "bg-red-500/15 text-red-700 border-red-300/50"
          : "bg-amber-500/15 text-amber-700 border-amber-300/50";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

function OrderHealthDot({ active }: { active: number }) {
  if (active === 0)
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-slate-300"
        title="No active orders"
      />
    );
  if (active <= 2)
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-amber-400"
        title={`${active} active order${active > 1 ? "s" : ""}`}
      />
    );
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-emerald-400"
      title={`${active} active orders`}
    />
  );
}

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const customersQuery = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async (): Promise<CustomersPayload> => {
      const response = await fetch("/api/admin/customers", {
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load customers.");
      }

      return {
        summary: body?.summary ?? {
          total: 0,
          withActiveOrders: 0,
          withNoOrders: 0,
          active: 0,
        },
        customers: (body?.customers ?? []) as CustomerRow[],
      };
    },
    refetchInterval: 60000,
  });

  const allCustomers = useMemo(
    () => customersQuery.data?.customers ?? [],
    [customersQuery.data?.customers],
  );
  const summary = customersQuery.data?.summary ?? {
    total: 0,
    withActiveOrders: 0,
    withNoOrders: 0,
    active: 0,
  };

  const filtered = useMemo(() => {
    return allCustomers.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.primaryContactEmail ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active-orders" && c.activeOrders > 0) ||
        (statusFilter === "no-orders" && c.totalOrders === 0) ||
        c.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allCustomers, search, statusFilter]);

  if (customersQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading customers...</p>;
  }

  if (customersQuery.isError) {
    return (
      <p className="text-sm text-red-600">
        {customersQuery.error instanceof Error
          ? customersQuery.error.message
          : "Could not load customers."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">Customers</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every organisation onboarded as a customer — their account standing,
          live orders, and order history at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Total Customers">
          <p className="text-3xl font-semibold text-slate-900">
            {summary.total}
          </p>
        </Card>
        <Card title="Active Accounts">
          <p className="text-3xl font-semibold text-slate-900">
            {summary.active}
          </p>
          <p className="mt-1 text-xs text-slate-500">Account status active</p>
        </Card>
        <Card title="With Live Orders">
          <p className="text-3xl font-semibold text-emerald-700">
            {summary.withActiveOrders}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Have at least one order in progress
          </p>
        </Card>
        <Card title="No Orders Yet">
          <p className="text-3xl font-semibold text-amber-600">
            {summary.withNoOrders}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Onboarded but never ordered
          </p>
        </Card>
      </div>

      <Card
        title="Customer Roster"
        description="Live order activity, account standing, and lifetime spend per customer."
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="active-orders">Has live orders</option>
            <option value="no-orders">No orders yet</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Standing</th>
                <th className="px-3 py-2">Orders</th>
                <th className="px-3 py-2">Lifetime Spend</th>
                <th className="px-3 py-2">Last Order</th>
                <th className="px-3 py-2">Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">
                      {customer.name}
                    </p>
                    {customer.slug ? (
                      <p className="text-xs text-slate-400">{customer.slug}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={customer.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <OrderHealthDot active={customer.activeOrders} />
                      <span className="text-slate-700">
                        {customer.activeOrders} active
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">
                        {customer.completedOrders} done
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-700">
                    {customer.lifetimeValueCents > 0 ? (
                      formatMoney(
                        customer.lifetimeValueCents,
                        customer.currencyCode,
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {customer.lastOrderAt ? (
                      new Date(customer.lastOrderAt).toLocaleDateString()
                    ) : (
                      <span className="text-slate-400">Never</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {customer.primaryContactEmail ?? (
                      <span className="text-slate-400">No contact</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-400" colSpan={6}>
                    No customers match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {filtered.length < allCustomers.length ? (
          <p className="mt-3 text-xs text-slate-400">
            Showing {filtered.length} of {allCustomers.length} customers
          </p>
        ) : null}
      </Card>
    </div>
  );
}

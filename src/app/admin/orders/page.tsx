"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AdminOrder = {
  id: string;
  status: string;
  total_cents: number;
  currency_code: string;
  po_reference: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
};

type OrderItem = {
  id: string;
  product_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price_cents: number | null;
  fulfillment_route: string | null;
};

type PartnerHandoff = {
  id: string;
  status: string;
  package_stream: string | null;
  metadata: Record<string, unknown> | null;
  assigned_at?: string | null;
};

type OrderDetailsPayload = {
  order: AdminOrder | null;
  items: OrderItem[];
  partnerHandoffs: PartnerHandoff[];
};

function formatMoney(amountCents: number, currencyCode: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currencyCode,
  }).format(amountCents / 100);
}

function formatStatusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
}

function statusBadgeClasses(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("failed") || normalized.includes("rejected")) {
    return "border-red-300/40 bg-red-500/15 text-red-100";
  }
  if (normalized.includes("delivered") || normalized.includes("complete")) {
    return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  }
  if (normalized.includes("reserved") || normalized.includes("processing")) {
    return "border-amber-300/40 bg-amber-500/15 text-amber-100";
  }
  return "border-slate-300/40 bg-slate-500/15 text-slate-100";
}

function isCompletedStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes("delivered") || normalized.includes("complete");
}

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") ?? "all").toLowerCase();
  const initialView =
    view === "active" || view === "completed" || view === "stale"
      ? view
      : "all";

  const [healthFilter, setHealthFilter] = useState<
    "all" | "active" | "completed" | "stale"
  >(initialView);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async (): Promise<AdminOrder[]> => {
      const response = await fetch("/api/system/workflow/orders", {
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load admin orders.");
      }

      return (body?.orders ?? []) as AdminOrder[];
    },
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const orderDetailsQuery = useQuery({
    queryKey: ["admin-order-details", selectedOrderId],
    queryFn: async (): Promise<OrderDetailsPayload> => {
      const response = await fetch(
        `/api/system/workflow/orders?orderId=${selectedOrderId}`,
        {
          credentials: "include",
        },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load order details.");
      }

      return {
        order: (body?.order ?? null) as AdminOrder | null,
        items: (body?.items ?? []) as OrderItem[],
        partnerHandoffs: (body?.partnerHandoffs ?? []) as PartnerHandoff[],
      };
    },
    enabled: Boolean(selectedOrderId),
  });

  const activeOrders = useMemo(
    () => orders.filter((order) => !isCompletedStatus(order.status)),
    [orders],
  );

  const completedOrders = useMemo(
    () => orders.filter((order) => isCompletedStatus(order.status)),
    [orders],
  );

  const staleOrders = useMemo(() => {
    const staleThreshold = Date.now() - 48 * 60 * 60 * 1000;
    return orders.filter((order) => {
      if (isCompletedStatus(order.status)) {
        return false;
      }
      const updatedAt = Date.parse(order.updated_at);
      return Number.isFinite(updatedAt) && updatedAt < staleThreshold;
    });
  }, [orders]);

  useEffect(() => {
    setHealthFilter(initialView);
  }, [initialView]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (healthFilter === "active" && isCompletedStatus(order.status)) {
        return false;
      }
      if (healthFilter === "completed" && !isCompletedStatus(order.status)) {
        return false;
      }
      if (healthFilter === "stale") {
        const isStale = staleOrders.some((stale) => stale.id === order.id);
        if (!isStale) {
          return false;
        }
      }

      if (
        statusFilter !== "all" &&
        order.status.toLowerCase() !== statusFilter.toLowerCase()
      ) {
        return false;
      }

      if (query.trim().length > 0) {
        const needle = query.toLowerCase();
        const haystack = [order.po_reference ?? "", order.id, order.status]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [healthFilter, orders, query, staleOrders, statusFilter]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    const hasCurrentSelection = filteredOrders.some(
      (order) => order.id === selectedOrderId,
    );
    if (!hasCurrentSelection) {
      setSelectedOrderId(filteredOrders[0]?.id ?? null);
    }
  }, [filteredOrders, selectedOrderId]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(orders.map((order) => order.status))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [orders]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const detailsOrder = orderDetailsQuery.data?.order ?? selectedOrder;
  const detailsItems = orderDetailsQuery.data?.items ?? [];
  const detailsHandoffs = orderDetailsQuery.data?.partnerHandoffs ?? [];

  if (ordersQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading orders...</p>;
  }

  if (ordersQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {ordersQuery.error instanceof Error
          ? ordersQuery.error.message
          : "Could not load admin orders."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Orders</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Review, filter, and inspect every order from one place.
          </p>
        </div>
        <Badge>{filteredOrders.length} Showing</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Active" description="Orders currently in progress.">
          <p className="text-3xl font-semibold text-white">
            {activeOrders.length}
          </p>
        </Card>
        <Card title="Completed" description="Delivered or fully complete.">
          <p className="text-3xl font-semibold text-white">
            {completedOrders.length}
          </p>
        </Card>
        <Card title="Needs Attention" description="Open longer than 48 hours.">
          <p className="text-3xl font-semibold text-amber-200">
            {staleOrders.length}
          </p>
        </Card>
      </div>

      <Card
        title="System Orders"
        description="Filter the list and open any order to view items, handoffs, and latest status."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              {
                key: "all",
                label: "All",
                count: orders.length,
              },
              {
                key: "active",
                label: "Active",
                count: activeOrders.length,
              },
              {
                key: "completed",
                label: "Completed",
                count: completedOrders.length,
              },
              {
                key: "stale",
                label: "Needs Attention",
                count: staleOrders.length,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() =>
                  setHealthFilter(
                    tab.key as "all" | "active" | "completed" | "stale",
                  )
                }
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${healthFilter === tab.key ? "border-cyan-300/50 bg-cyan-500/15 text-cyan-100" : "border-white/20 text-slate-300 hover:bg-white/5"}`}
              >
                <span>{tab.label}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div>
              <p className="mb-1 text-xs text-slate-300">Search</p>
              <input
                className="h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                placeholder="PO number, order id, or status"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div>
              <p className="mb-1 text-xs text-slate-300">Status</p>
              <select
                className="h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                className="h-10 rounded-lg border border-white/20 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setHealthFilter("all");
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`cursor-pointer border-b border-white/10 ${selectedOrderId === order.id ? "bg-cyan-500/10" : "hover:bg-white/5"}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-white">
                          {order.po_reference ?? order.id}
                        </p>
                        <p className="text-xs text-slate-400">{order.id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(order.status)}`}
                        >
                          {formatStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {formatMoney(order.total_cents, order.currency_code)}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        {formatDateTime(order.updated_at)}
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={4}>
                        No orders match these filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              {!selectedOrderId ? (
                <p className="text-sm text-slate-300">
                  Select an order from the list to view details.
                </p>
              ) : orderDetailsQuery.isLoading ? (
                <p className="text-sm text-slate-300">
                  Loading order details...
                </p>
              ) : orderDetailsQuery.isError ? (
                <p className="text-sm text-red-300">
                  {orderDetailsQuery.error instanceof Error
                    ? orderDetailsQuery.error.message
                    : "Could not load order details."}
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">
                        Order Summary
                      </p>
                      <h3 className="text-lg font-semibold text-white">
                        {detailsOrder?.po_reference ??
                          detailsOrder?.id ??
                          selectedOrderId}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(detailsOrder?.status ?? "unknown")}`}
                    >
                      {formatStatusLabel(detailsOrder?.status ?? "unknown")}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                      <p className="text-[11px] text-slate-400">Order Value</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {detailsOrder
                          ? formatMoney(
                              detailsOrder.total_cents,
                              detailsOrder.currency_code,
                            )
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                      <p className="text-[11px] text-slate-400">Last Updated</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {detailsOrder
                          ? formatDateTime(detailsOrder.updated_at)
                          : "-"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Line Items
                    </p>
                    <div className="mt-2 space-y-2">
                      {detailsItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-white/10 bg-white/5 p-2.5"
                        >
                          <p className="text-sm font-medium text-white">
                            {item.product_name ?? item.sku ?? "Unnamed item"}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            Qty: {item.quantity}
                            {item.fulfillment_route
                              ? ` | Route: ${item.fulfillment_route}`
                              : ""}
                          </p>
                        </div>
                      ))}
                      {detailsItems.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No line items found for this order.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Partner Handoffs
                    </p>
                    <div className="mt-2 space-y-2">
                      {detailsHandoffs.map((handoff) => (
                        <div
                          key={handoff.id}
                          className="rounded-lg border border-white/10 bg-white/5 p-2.5"
                        >
                          <p className="text-sm font-medium text-white">
                            {handoff.package_stream ?? "Unassigned stream"}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            Status: {formatStatusLabel(handoff.status)}
                          </p>
                        </div>
                      ))}
                      {detailsHandoffs.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No handoff activity yet.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AdminWorkflowOrder = {
  id: string;
  status: string;
  total_cents: number;
  currency_code: string;
  po_reference: string | null;
  created_at: string;
  updated_at?: string;
  metadata?: {
    workflow_timeline?: Array<{
      id?: string;
      actor?: string;
      message?: string;
      at?: string;
    }>;
    delivered_to?: string;
    delivered_at?: string;
    sla_status?: string;
  } | null;
};

function formatMoney(amountCents: number, currencyCode: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currencyCode,
  }).format(amountCents / 100);
}

export default function AdminWorkflowsPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["admin-workflow-orders"],
    queryFn: async (): Promise<AdminWorkflowOrder[]> => {
      const response = await fetch("/api/system/workflow/orders", {
        method: "GET",
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load admin workflow history.");
      }

      return (body?.orders ?? []) as AdminWorkflowOrder[];
    },
  });

  const orders = ordersQuery.data ?? [];

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) {
      return orders[0] ?? null;
    }
    return orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null;
  }, [orders, selectedOrderId]);

  if (ordersQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading admin workflow history...</p>;
  }

  if (ordersQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {ordersQuery.error instanceof Error
          ? ordersQuery.error.message
          : "Could not load admin workflow history."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Admin Workflow History</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Cross-role order history, delivery outcomes, and SLA closure for admins and staff.
          </p>
        </div>
        <Badge>{orders.length} Orders</Badge>
      </div>

      {orders.length === 0 ? (
        <Card title="No orders yet" description="Workflow history will appear here as orders are processed.">
          <p className="text-sm text-slate-300">No workflow records are available yet.</p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
          <Card title="Orders" description="Select an order to inspect its lifecycle.">
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selectedOrder?.id === order.id
                      ? "border-coral bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">
                      {order.po_reference ?? order.id}
                    </span>
                    <span className="text-[11px] text-slate-300">{order.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {formatMoney(order.total_cents, order.currency_code)}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title={selectedOrder?.po_reference ?? selectedOrder?.id ?? "Order details"}
            description={selectedOrder?.updated_at ? `Updated ${new Date(selectedOrder.updated_at).toLocaleString()}` : "Workflow lifecycle"}
          >
            {selectedOrder ? (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge>{selectedOrder.status}</Badge>
                  {selectedOrder.metadata?.sla_status ? (
                    <Badge>
                      SLA {selectedOrder.metadata.sla_status === "met" ? "Met" : "Missed"}
                    </Badge>
                  ) : null}
                  {selectedOrder.metadata?.delivered_to ? (
                    <Badge>Delivered to {selectedOrder.metadata.delivered_to}</Badge>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">Created</p>
                    <p className="mt-1">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">Delivered At</p>
                    <p className="mt-1">
                      {selectedOrder.metadata?.delivered_at
                        ? new Date(selectedOrder.metadata.delivered_at).toLocaleString()
                        : "Awaiting delivery"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">Value</p>
                    <p className="mt-1">{formatMoney(selectedOrder.total_cents, selectedOrder.currency_code)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">History</h3>
                  {selectedOrder.metadata?.workflow_timeline?.length ? (
                    <div className="space-y-2">
                      {selectedOrder.metadata.workflow_timeline.map((event, index) => (
                        <div
                          key={event.id ?? `${selectedOrder.id}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">
                              {event.message ?? "Workflow event"}
                            </p>
                            <p className="text-[11px] text-slate-300">
                              {event.at ? new Date(event.at).toLocaleString() : "Unknown time"}
                            </p>
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                            {event.actor ?? "system"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">No history recorded yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}

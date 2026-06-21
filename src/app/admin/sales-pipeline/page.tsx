"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useGetAdminSalesPipelineQuery } from "@/store/redux/api/admin-api";

type SalesPipelineOrder = {
  id: string;
  status: string;
  totalCents: number;
  currencyCode: string;
  poReference: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
};

type SalesPipelinePayload = {
  metrics: {
    total: number;
    active: number;
    completed: number;
    staleOpen: number;
  };
  byStatus: Record<string, number>;
  orders: SalesPipelineOrder[];
};

function formatMoney(amountCents: number, currencyCode: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currencyCode,
  }).format(amountCents / 100);
}

export default function AdminSalesPipelinePage() {
  const pipelineQuery = useGetAdminSalesPipelineQuery("pipeline");

  const data = (pipelineQuery.data ?? {
    metrics: { total: 0, active: 0, completed: 0, staleOpen: 0 },
    byStatus: {},
    orders: [],
  }) as SalesPipelinePayload;

  const statusRows = useMemo(() => {
    const byStatus = data.byStatus ?? {};
    return Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  }, [data.byStatus]);

  if (pipelineQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading sales pipeline...</p>;
  }

  if (pipelineQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {pipelineQuery.error instanceof Error
          ? pipelineQuery.error.message
          : "Could not load sales pipeline."}
      </p>
    );
  }

  const metrics = data.metrics;
  const orders = data.orders;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Sales Pipeline</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Where every order stands right now — and which ones have gone quiet
            and need a nudge.
          </p>
        </div>
        <Badge>{metrics.total} Orders</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Active">
          <p className="text-3xl font-semibold text-white">{metrics.active}</p>
        </Card>
        <Card title="Completed">
          <p className="text-3xl font-semibold text-white">
            {metrics.completed}
          </p>
        </Card>
        <Card title="Stale Open">
          <p className="text-3xl font-semibold text-white">
            {metrics.staleOpen}
          </p>
        </Card>
        <Card title="Completion Rate">
          <p className="text-3xl font-semibold text-white">
            {metrics.total > 0
              ? `${Math.round((metrics.completed / metrics.total) * 100)}%`
              : "0%"}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card
          title="Status Distribution"
          description="Current orders grouped by status."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map(([status, count]) => (
                  <tr key={status} className="border-b border-white/10">
                    <td className="px-3 py-2">{status}</td>
                    <td className="px-3 py-2">{count}</td>
                  </tr>
                ))}
                {statusRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={2}>
                      No status data.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Recent Orders"
          description="Latest order updates in the sales pipeline."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-white/10">
                    <td className="px-3 py-2">
                      {order.poReference ?? order.id}
                    </td>
                    <td className="px-3 py-2">
                      {order.customerName ?? "Unknown"}
                    </td>
                    <td className="px-3 py-2">{order.status}</td>
                    <td className="px-3 py-2">
                      {formatMoney(order.totalCents, order.currencyCode)}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(order.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={5}>
                      No orders found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

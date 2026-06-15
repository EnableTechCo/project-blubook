"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type PartnerReportHandoff = {
  id: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "rejected";
  package_stream: string;
  assigned_at: string;
  metadata: {
    source_provider_name?: string | null;
    target_provider_name?: string | null;
  } | null;
  sales_order_items: {
    product_name: string;
    sales_orders: {
      po_reference: string | null;
      status: string;
    } | null;
  } | null;
};

export default function PartnerReportsPage() {
  const reportsQuery = useQuery({
    queryKey: ["partner-report-handoffs"],
    queryFn: async (): Promise<PartnerReportHandoff[]> => {
      const response = await fetch("/api/partner/work-orders", {
        method: "GET",
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load partner reports.");
      }

      return (body?.inboundProviderHandoffs ?? []) as PartnerReportHandoff[];
    },
  });

  const stats = useMemo(() => {
    const items = reportsQuery.data ?? [];
    const total = items.length;
    const completed = items.filter(
      (item) => item.status === "completed",
    ).length;
    const inProgress = items.filter((item) =>
      ["accepted", "in_progress"].includes(item.status),
    ).length;
    const rejected = items.filter((item) => item.status === "rejected").length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      rejected,
      completionRate,
      latestCompleted: items
        .filter((item) => item.status === "completed")
        .slice(0, 8),
    };
  }, [reportsQuery.data]);

  if (reportsQuery.isLoading) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Loading partner history...
      </p>
    );
  }

  if (reportsQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {reportsQuery.error instanceof Error
          ? reportsQuery.error.message
          : "Could not load partner reports."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Partner Reports
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200/85">
            Historical partner handoffs, completion rate, and delivery outcomes.
          </p>
        </div>
        <Badge>{stats.total} Total Handoffs</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Completion Rate" description="Assigned to completed">
          <p className="text-3xl font-semibold text-mint">
            {stats.completionRate}%
          </p>
        </Card>
        <Card title="Completed" description="Finished operations">
          <p className="text-3xl font-semibold text-coral">{stats.completed}</p>
        </Card>
        <Card title="In Progress" description="Accepted or active work">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {stats.inProgress}
          </p>
        </Card>
        <Card title="Rejected" description="Declined or failed jobs">
          <p className="text-3xl font-semibold text-red-300">
            {stats.rejected}
          </p>
        </Card>
      </div>

      <Card
        title="Completed Handoff History"
        description="Recent completed logistics assignments and their final order states."
      >
        {stats.latestCompleted.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No completed handoffs yet.
          </p>
        ) : (
          <div className="space-y-3">
            {stats.latestCompleted.map((item) => {
              const poRef =
                item.sales_order_items?.sales_orders?.po_reference ??
                "No PO reference";
              const product =
                item.sales_order_items?.product_name ?? "Product unavailable";
              const finalOrderStatus =
                item.sales_order_items?.sales_orders?.status ?? "Unknown";

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-white/15 dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      PO {poRef}
                    </p>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">
                      {new Date(item.assigned_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {product}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Final order state: {finalOrderStatus}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Source:{" "}
                    {item.metadata?.source_provider_name ?? "Unknown source"}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

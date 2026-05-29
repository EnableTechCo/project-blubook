"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MOCK_CUSTOMER_REQUESTS } from "@/features/mock/dashboard-data";

export default function CustomerAnalyticsPage() {
  const stats = useMemo(() => {
    const items = MOCK_CUSTOMER_REQUESTS;
    const total = items.length;
    const completed = items.filter(
      (item) => item.status === "completed",
    ).length;
    const open = items.filter(
      (item) => !["completed", "cancelled"].includes(item.status),
    ).length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgAgeDays =
      total > 0
        ? Math.round(
            items.reduce((sum, item) => {
              const ageMs = Date.now() - new Date(item.created_at).getTime();
              return sum + ageMs / (1000 * 60 * 60 * 24);
            }, 0) / total,
          )
        : 0;

    const byStatus = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});

    return { total, completed, open, completionRate, avgAgeDays, byStatus };
  }, []);

  const statusRows = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Phase 2
          </p>
          <h2 className="text-3xl font-semibold text-white">
            Customer Analytics
          </h2>
        </div>
        <Badge>{stats.total} Requests</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Open Requests" description="Active workload">
          <p className="text-3xl font-semibold text-white">{stats.open}</p>
        </Card>
        <Card title="Completion Rate" description="Submitted to completed">
          <p className="text-3xl font-semibold text-mint">
            {stats.completionRate}%
          </p>
        </Card>
        <Card title="Avg Ticket Age" description="Days since creation">
          <p className="text-3xl font-semibold text-sun">{stats.avgAgeDays}d</p>
        </Card>
        <Card title="Completed" description="Total finished requests">
          <p className="text-3xl font-semibold text-coral">{stats.completed}</p>
        </Card>
      </div>

      <Card
        title="Status Distribution"
        description="Current request spread by status from hardcoded dataset."
      >
        <div className="mt-2 space-y-3">
          {statusRows.map(([status, count]) => {
            const pct =
              stats.total > 0
                ? Math.max(6, Math.round((count / stats.total) * 100))
                : 0;
            return (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-200/90">
                  <span className="capitalize">
                    {status.replaceAll("_", " ")}
                  </span>
                  <span>{count}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-coral"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {statusRows.length === 0 ? (
            <p className="text-sm text-slate-300">
              No requests available for analytics yet.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

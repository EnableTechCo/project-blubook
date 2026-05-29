"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MOCK_CUSTOMER_REQUESTS } from "@/features/mock/dashboard-data";

export default function PartnerReportsPage() {
  const stats = useMemo(() => {
    const items = MOCK_CUSTOMER_REQUESTS;
    const total = items.length;
    const completed = items.filter(
      (item) => item.status === "completed",
    ).length;
    const inProgress = items.filter(
      (item) => item.status === "in_progress",
    ).length;
    const rejected = items.filter((item) => item.status === "rejected").length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    const byPriority = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.priority] = (acc[item.priority] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total,
      completed,
      inProgress,
      rejected,
      completionRate,
      byPriority,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Phase 2
          </p>
          <h2 className="text-3xl font-semibold text-white">Partner Reports</h2>
        </div>
        <Badge>{stats.total} Assigned</Badge>
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
        <Card title="In Progress" description="Active work orders">
          <p className="text-3xl font-semibold text-white">
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
        title="Priority Mix"
        description="Hardcoded workload composition by priority."
      >
        <div className="mt-2 space-y-3">
          {Object.entries(stats.byPriority).map(([priority, count]) => {
            const pct =
              stats.total > 0
                ? Math.max(6, Math.round((count / stats.total) * 100))
                : 0;
            return (
              <div key={priority}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-200/90">
                  <span className="uppercase">{priority}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-mint"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(stats.byPriority).length === 0 ? (
            <p className="text-sm text-slate-300">No assigned workload yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  MOCK_AI_AUTOMATIONS,
  MOCK_STAFF_DASHBOARD_PACK,
} from "@/features/mock/dashboard-data";

export default function StaffDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDashboard() {
      await Promise.resolve();

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void bootstrapDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <DashboardLoadingSkeleton metricCount={4} listCount={3} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Staff Operations Dashboard
          </h2>
          <p className="mt-2 text-sm text-slate-200/85">
            {MOCK_STAFF_DASHBOARD_PACK.subheading}
          </p>
        </div>
        <Badge>Phase 3 Data Pack</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MOCK_STAFF_DASHBOARD_PACK.metrics.map((metric) => (
          <Card key={metric.id} title={metric.label} description={metric.hint}>
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
            {metric.delta ? (
              <p className="mt-1 text-xs text-slate-300">{metric.delta}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Cross-Team Tasks"
          description="Mock operational queue for standups."
        >
          <div className="space-y-3">
            {MOCK_STAFF_DASHBOARD_PACK.tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">{task.title}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Owner: {task.owner} | ETA: {task.eta}
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Status: {task.status}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Anomaly Alerts"
          description="Signals from AI anomaly detection model."
        >
          <div className="space-y-3">
            {MOCK_STAFF_DASHBOARD_PACK.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-coral">
                  {alert.title}
                </p>
                <p className="mt-1 text-xs text-slate-300">{alert.detail}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Source: {alert.source}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="AI Recommendations"
          description="Next-best actions for operators."
        >
          <div className="space-y-3">
            {MOCK_STAFF_DASHBOARD_PACK.aiRecommendations.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">{item.reason}</p>
                <p className="mt-2 text-xs text-slate-200">
                  Action: {item.action}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Automation Health"
          description="Mock automation flows for ticket implementation and QA."
        >
          <div className="space-y-3">
            {MOCK_AI_AUTOMATIONS.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">{item.name}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Trigger: {item.trigger}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Status: {item.status}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

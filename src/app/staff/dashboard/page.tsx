"use client";

import { useEffect, useState } from "react";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const STAFF_OPERATION_AREAS = [
  {
    title: "Cross-Team Tasks",
    description:
      "Monitor tasks that require handoff between sales, staff, and logistics.",
    points: [
      "Review newly assigned operational tasks.",
      "Escalate blockers that impact SLA windows.",
      "Confirm completion evidence is attached before closure.",
    ],
  },
  {
    title: "Anomaly Alerts",
    description: "Review workflow anomalies and route them for remediation.",
    points: [
      "Validate anomaly signals against current order state.",
      "Assign owner and remediation action.",
      "Close or re-open alerts based on evidence.",
    ],
  },
  {
    title: "Recommendations",
    description:
      "Action recommendations are generated from active workflow events.",
    points: [
      "Prioritize recommendations with SLA impact.",
      "Approve only recommendations with sufficient context.",
      "Capture overrides for governance review.",
    ],
  },
  {
    title: "Automation Health",
    description: "Track automation reliability and failed execution runs.",
    points: [
      "Check failed automation executions.",
      "Retry eligible workflows after validation.",
      "Log recurring failures for engineering follow-up.",
    ],
  },
] as const;

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
            Operational visibility for live workflow queues and intervention
            points.
          </p>
        </div>
        <Badge>Phase 3 Operations</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAFF_OPERATION_AREAS.map((area) => (
          <Card
            key={area.title}
            title={area.title}
            description={area.description}
          >
            <p className="text-sm text-slate-200">
              Live values are shown in dedicated workflow views.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Status: monitoring enabled
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {STAFF_OPERATION_AREAS.map((area) => (
          <Card
            key={`${area.title}-detail`}
            title={area.title}
            description={area.description}
          >
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-100/90">
              {area.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
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

// ─── SLA risk queue ─────────────────────────────────────────────────────────

type SlaRiskLevel = "low" | "medium" | "high";

type SlaRiskItem = {
  orderId: string;
  poReference: string;
  status: string;
  riskLevel: SlaRiskLevel;
  reason: string;
  suggestedAction: string;
  hoursElapsed: number;
  hoursRemaining: number;
  slaTargetHours: number;
};

const RISK_CLASSES: Record<SlaRiskLevel, string> = {
  high: "border-coral/40 bg-coral/10 text-coral",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  low: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
};

const SLA_RISK_POLL_INTERVAL_MS = 30_000;

export default function StaffDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  const [risks, setRisks] = useState<SlaRiskItem[]>([]);
  const [riskCounts, setRiskCounts] = useState({ high: 0, medium: 0, low: 0 });
  const [risksLoading, setRisksLoading] = useState(true);
  const [risksError, setRisksError] = useState<string | null>(null);

  const loadSlaRisks = useCallback(async () => {
    setRisksError(null);

    try {
      const response = await fetch("/api/staff/sla-risk", {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        risks?: SlaRiskItem[];
        counts?: { high: number; medium: number; low: number };
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load SLA breach risk data.");
      }

      setRisks(body.risks ?? []);
      setRiskCounts(body.counts ?? { high: 0, medium: 0, low: 0 });
    } catch (loadError) {
      setRisksError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load SLA breach risk data.",
      );
    } finally {
      setRisksLoading(false);
    }
  }, []);

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

  useEffect(() => {
    void loadSlaRisks();

    const interval = setInterval(() => {
      void loadSlaRisks();
    }, SLA_RISK_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadSlaRisks]);

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

      {/* ── SLA Breach Risk Queue ─────────────────────────────────────────── */}
      <Card
        title={`SLA Breach Risk Queue${riskCounts.high > 0 ? ` (${riskCounts.high} high risk)` : ""}`}
        description="Active orders ranked by risk of missing their SLA window, with a suggested next action. Refreshes automatically every 30 seconds."
      >
        <div className="space-y-3">
          {risksError ? (
            <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {risksError}
            </p>
          ) : null}

          {risksLoading ? (
            <p className="text-xs text-slate-400">Calculating SLA risk…</p>
          ) : risks.length === 0 ? (
            <p className="text-xs text-slate-400">
              No active orders — nothing at risk right now.
            </p>
          ) : (
            <div className="space-y-3">
              {risks.map((item) => (
                <div
                  key={item.orderId}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${RISK_CLASSES[item.riskLevel]}`}
                        >
                          {item.riskLevel} risk
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {item.poReference}
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.status}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-slate-300">
                        {item.reason}
                      </p>

                      <p className="mt-1.5 text-xs text-slate-200">
                        <span className="text-slate-500">Suggested action: </span>
                        {item.suggestedAction}
                      </p>
                    </div>

                    <div className="shrink-0 text-right text-[11px] text-slate-400">
                      <p>{item.hoursElapsed}h elapsed</p>
                      <p>
                        {item.hoursRemaining >= 0
                          ? `${item.hoursRemaining}h remaining`
                          : `${Math.abs(item.hoursRemaining)}h over SLA`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

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

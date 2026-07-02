"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// ─── Task assignment recommendations ───────────────────────────────────────

type TaskType = "pick_ticket" | "work_order";

type StaffOwnerOption = {
  userId: string;
  name: string;
  openTaskCount: number;
};

type TaskAssignmentRecommendation = {
  taskId: string;
  taskType: TaskType;
  orderReference: string;
  productName: string;
  urgencyHours: number;
  primary: StaffOwnerOption;
  backups: StaffOwnerOption[];
  reason: string;
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  pick_ticket: "Pick Ticket",
  work_order: "Work Order",
};

const ASSIGNMENT_POLL_INTERVAL_MS = 30_000;

export default function StaffDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  const [recommendations, setRecommendations] = useState<
    TaskAssignmentRecommendation[]
  >([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setRecsError(null);

    try {
      const response = await fetch("/api/staff/task-assignments", {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        recommendations?: TaskAssignmentRecommendation[];
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? "Could not load task assignment recommendations.",
        );
      }

      setRecommendations(body.recommendations ?? []);
    } catch (loadError) {
      setRecsError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load task assignment recommendations.",
      );
    } finally {
      setRecsLoading(false);
    }
  }, []);

  const handleAssign = async (
    task: TaskAssignmentRecommendation,
    owner: StaffOwnerOption,
  ) => {
    if (assigning) return;
    setAssigning(task.taskId);

    try {
      const response = await fetch(`/api/staff/task-assignments/${task.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taskType: task.taskType, ownerId: owner.userId }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not assign task.");
      }

      setRecommendations((current) =>
        current.filter((r) => r.taskId !== task.taskId),
      );
    } catch (assignError) {
      setRecsError(
        assignError instanceof Error
          ? assignError.message
          : "Could not assign task.",
      );
    } finally {
      setAssigning(null);
    }
  };

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
    void loadRecommendations();

    const interval = setInterval(() => {
      void loadRecommendations();
    }, ASSIGNMENT_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadRecommendations]);

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

      {/* ── Smart Assignment Recommendations ──────────────────────────────── */}
      <Card
        title={`Smart Assignment Recommendations${recommendations.length > 0 ? ` (${recommendations.length} pending)` : ""}`}
        description="Unassigned fulfillment tasks ranked by how long they've been waiting, with a primary owner suggestion and backups based on current team workload. Refreshes automatically every 30 seconds."
      >
        <div className="space-y-3">
          {recsError ? (
            <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {recsError}
            </p>
          ) : null}

          {recsLoading ? (
            <p className="text-xs text-slate-400">Calculating recommendations…</p>
          ) : recommendations.length === 0 ? (
            <p className="text-xs text-slate-400">
              No unassigned tasks — every pick ticket and work order has an
              owner.
            </p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((task) => (
                <div
                  key={task.taskId}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-blue-400/40 bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-200">
                          {TASK_TYPE_LABELS[task.taskType]}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {task.productName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {task.orderReference}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-slate-300">
                        {task.reason}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          className="h-8 px-3 text-xs"
                          disabled={assigning === task.taskId}
                          onClick={() => void handleAssign(task, task.primary)}
                        >
                          {assigning === task.taskId
                            ? "Assigning…"
                            : `Assign to ${task.primary.name}`}
                        </Button>

                        {task.backups.map((backup) => (
                          <Button
                            key={backup.userId}
                            variant="ghost"
                            className="h-8 px-3 text-xs text-slate-300 hover:text-white"
                            disabled={assigning === task.taskId}
                            onClick={() => void handleAssign(task, backup)}
                          >
                            Assign to {backup.name} ({backup.openTaskCount} open)
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 text-right text-[11px] text-slate-400">
                      <p>{task.urgencyHours}h waiting</p>
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

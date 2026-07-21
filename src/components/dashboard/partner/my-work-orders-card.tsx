"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Provider work-order execution (Phase 3, P3-5).
//
// Mirrors MyServiceRequestsCard: claim-free (routing already assigned the
// work), accept to start, mark complete when done. Completing here releases
// whatever the work was blocking, so the next provider is dispatched
// automatically.
//
// Nothing about the customer is shown, because the API never sends it.

type WorkOrder = {
  id: string;
  reference: string;
  label: string;
  description: string | null;
  serviceName: string;
  status: "assigned" | "in_progress" | "completed";
  releasedAt: string | null;
  completedAt: string | null;
};

const STATUS_CLASSES: Record<string, string> = {
  assigned: "border-amber-400/30 bg-amber-400/10 text-amber-600",
  in_progress: "border-blue-400/40 bg-blue-500/10 text-blue-600",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-600",
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "New",
  in_progress: "In Progress",
  completed: "Completed",
};

const POLL_INTERVAL_MS = 30_000;

export function MyWorkOrdersCard() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadWorkOrders = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/partner/work-request-items", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        workOrders?: WorkOrder[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not load your work orders.");
      }
      setWorkOrders(body.workOrders ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your work orders.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkOrders();
    const interval = setInterval(() => {
      void loadWorkOrders();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadWorkOrders]);

  const handleTransition = async (
    id: string,
    action: "accept" | "complete",
    fallbackErrorMessage: string,
  ) => {
    if (transitioningId) return;
    setTransitioningId(id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/partner/work-request-items/${id}/${action}`,
        { method: "POST", credentials: "include" },
      );
      const body = (await response.json()) as {
        error?: string;
        status?: string;
        released?: number;
        requestCompleted?: boolean;
      };
      if (!response.ok) {
        throw new Error(body.error ?? fallbackErrorMessage);
      }

      if (action === "complete") {
        // Completing may have unblocked downstream work — reload rather than
        // patching in place, since this provider may have just been given more.
        if (body.requestCompleted) {
          setNotice("That completed the customer's whole request.");
        } else if (body.released && body.released > 0) {
          setNotice(
            `Completed — that released ${body.released} follow-on work order${body.released === 1 ? "" : "s"}.`,
          );
        }
        await loadWorkOrders();
      } else {
        setWorkOrders((current) =>
          current.map((w) =>
            w.id === id
              ? { ...w, status: (body.status as WorkOrder["status"]) ?? w.status }
              : w,
          ),
        );
      }
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : fallbackErrorMessage,
      );
    } finally {
      setTransitioningId(null);
    }
  };

  if (isLoading) return null;
  if (workOrders.length === 0 && !error) return null;

  return (
    <Card
      title={`My Work Orders${workOrders.length > 0 ? ` (${workOrders.length})` : ""}`}
      description="Work routed to you. Accept to start, mark complete when finished — completing releases whatever this work was holding up."
    >
      <div className="space-y-3">
        {error ? (
          <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
            {notice}
          </p>
        ) : null}

        {workOrders.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[item.status] ?? STATUS_CLASSES.assigned}`}
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {item.serviceName} · {item.reference}
                  </span>
                </div>
                {item.description ? (
                  <p className="mt-1.5 text-xs text-slate-600">
                    {item.description}
                  </p>
                ) : null}
              </div>

              {item.status === "assigned" ? (
                <Button
                  className="h-8 shrink-0 px-3 text-xs"
                  disabled={transitioningId === item.id}
                  onClick={() =>
                    void handleTransition(
                      item.id,
                      "accept",
                      "Could not accept work order.",
                    )
                  }
                >
                  {transitioningId === item.id ? "Accepting…" : "Accept"}
                </Button>
              ) : null}

              {item.status === "in_progress" ? (
                <Button
                  className="h-8 shrink-0 px-3 text-xs"
                  disabled={transitioningId === item.id}
                  onClick={() =>
                    void handleTransition(
                      item.id,
                      "complete",
                      "Could not complete work order.",
                    )
                  }
                >
                  {transitioningId === item.id ? "Completing…" : "Mark Complete"}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

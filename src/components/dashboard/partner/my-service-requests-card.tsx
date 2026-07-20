"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type MyServiceRequest = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const STATUS_CLASSES: Record<string, string> = {
  submitted: "border-amber-400/30 bg-amber-400/10 text-amber-600",
  in_progress: "border-blue-400/40 bg-blue-500/10 text-blue-600",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-600",
  rejected: "border-slate-300 bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Claimed",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};

const POLL_INTERVAL_MS = 30_000;

export function MyServiceRequestsCard() {
  const [requests, setRequests] = useState<MyServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const loadMyRequests = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch("/api/partner/service-requests/mine", {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        requests?: MyServiceRequest[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load your service requests.");
      }

      setRequests(body.requests ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your service requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyRequests();

    const interval = setInterval(() => {
      void loadMyRequests();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadMyRequests]);

  const handleTransition = async (
    requestId: string,
    action: "accept" | "complete",
    fallbackErrorMessage: string,
  ) => {
    if (transitioningId) return;
    setTransitioningId(requestId);

    try {
      const response = await fetch(
        `/api/partner/service-requests/${requestId}/${action}`,
        { method: "PATCH", credentials: "include" },
      );

      const body = (await response.json()) as { error?: string; status?: string };
      if (!response.ok) {
        throw new Error(body.error ?? fallbackErrorMessage);
      }

      setRequests((current) =>
        current.map((r) =>
          r.id === requestId ? { ...r, status: body.status ?? r.status } : r,
        ),
      );
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

  if (isLoading) {
    return null;
  }

  if (requests.length === 0 && !error) {
    return null;
  }

  return (
    <Card
      title={`My Service Requests${requests.length > 0 ? ` (${requests.length})` : ""}`}
      description="Requests you've claimed. Accept to start work, mark complete when finished."
    >
      <div className="space-y-3">
        {error ? (
          <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        ) : null}

        {requests.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[item.status] ?? STATUS_CLASSES.submitted}`}
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </span>
                </div>
                {item.description ? (
                  <p className="mt-1.5 text-xs text-slate-600">
                    {item.description}
                  </p>
                ) : null}
              </div>

              {item.status === "submitted" ? (
                <Button
                  className="h-8 shrink-0 px-3 text-xs"
                  disabled={transitioningId === item.id}
                  onClick={() =>
                    void handleTransition(
                      item.id,
                      "accept",
                      "Could not accept request.",
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
                      "Could not complete request.",
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

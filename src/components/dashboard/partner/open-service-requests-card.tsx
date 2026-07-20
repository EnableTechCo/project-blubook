"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type OpenServiceRequest = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
};

const PRIORITY_CLASSES: Record<string, string> = {
  urgent: "border-coral/40 bg-coral/10 text-coral",
  high: "border-amber-400/30 bg-amber-400/10 text-amber-600",
  medium: "border-slate-300 bg-slate-100 text-slate-600",
  low: "border-slate-200 bg-slate-50 text-slate-500",
};

const POLL_INTERVAL_MS = 30_000;

export function OpenServiceRequestsCard() {
  const [requests, setRequests] = useState<OpenServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const loadOpenRequests = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch("/api/partner/service-requests", {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        requests?: OpenServiceRequest[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load open service requests.");
      }

      setRequests(body.requests ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load open service requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOpenRequests();

    const interval = setInterval(() => {
      void loadOpenRequests();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadOpenRequests]);

  const handleClaim = async (requestId: string) => {
    if (claimingId) return;
    setClaimingId(requestId);

    try {
      const response = await fetch(
        `/api/partner/service-requests/${requestId}/claim`,
        { method: "PATCH", credentials: "include" },
      );

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not claim request.");
      }

      setRequests((current) => current.filter((r) => r.id !== requestId));
    } catch (claimError) {
      setError(
        claimError instanceof Error
          ? claimError.message
          : "Could not claim request.",
      );
    } finally {
      setClaimingId(null);
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
      title={`Open Service Requests${requests.length > 0 ? ` (${requests.length})` : ""}`}
      description="Unclaimed customer requests. Claim one to take ownership and start work."
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
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_CLASSES[item.priority] ?? PRIORITY_CLASSES.medium}`}
                  >
                    {item.priority}
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

              <Button
                variant="ghost"
                className="h-8 shrink-0 px-3 text-xs"
                disabled={claimingId === item.id}
                onClick={() => void handleClaim(item.id)}
              >
                {claimingId === item.id ? "Claiming…" : "Claim"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

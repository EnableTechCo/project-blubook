"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Card } from "@/components/ui/card";

// The customer's past requests (Phase 4, P4-4).
//
// Deliberately a summary, not a second timeline: its job is to get someone to
// the right request. It renders nothing at all when there are none, so a
// first-time customer sees only the menu.

type WorkRequestSummary = {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  itemCount: number;
  completedCount: number;
};

const STATUS_CLASSES: Record<string, string> = {
  active: "border-blue-400/40 bg-blue-500/10 text-blue-600",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-600",
  cancelled: "border-slate-300 bg-slate-100 text-slate-500",
  draft: "border-slate-300 bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<string, string> = {
  active: "In Progress",
  completed: "Complete",
  cancelled: "Cancelled",
  draft: "Draft",
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

export function MyWorkRequestsCard() {
  const [requests, setRequests] = useState<WorkRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/work-requests/mine", {
        credentials: "include",
      });
      const body = (await res.json()) as { requests?: WorkRequestSummary[] };
      if (res.ok) setRequests(body.requests ?? []);
    } catch {
      // A failure to list history must not obstruct requesting new work.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading || requests.length === 0) return null;

  return (
    <Card
      title="Your requests"
      description="Open one to see how the work is progressing."
    >
      <ul className="space-y-2">
        {requests.map((request) => (
          <li key={request.id}>
            <Link
              href={`/customer/work-requests/${request.id}` as Route}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    STATUS_CLASSES[request.status] ?? STATUS_CLASSES.draft
                  }`}
                >
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
                <span className="text-sm font-medium text-slate-900">
                  {request.reference}
                </span>
                <span className="text-xs text-slate-400">
                  {formatWhen(request.createdAt)}
                </span>
              </span>
              <span className="text-xs text-slate-500">
                {request.completedCount} of {request.itemCount} complete
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

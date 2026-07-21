"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { InlineErrorMessage } from "@/components/ui/inline-error-message";

// Customer's window into one request (Phase 4, P4-4).
//
// Everything shown comes from the timeline API, which never selects a provider,
// so there is nothing here that could name who is doing the work.

type TimelineEntry = {
  at: string;
  kind: string;
  message: string;
  itemLabel?: string;
};

type TimelineItem = {
  label: string;
  serviceName: string;
  status: string;
  autoIncluded: boolean;
  blockedByLabel: string | null;
};

type Timeline = {
  reference: string;
  status: string;
  createdAt: string;
  itemCount: number;
  completedCount: number;
  items: TimelineItem[];
  entries: TimelineEntry[];
};

const STATUS_CLASSES: Record<string, string> = {
  blocked: "border-slate-300 bg-slate-100 text-slate-600",
  ready: "border-amber-400/30 bg-amber-400/10 text-amber-600",
  assigned: "border-amber-400/30 bg-amber-400/10 text-amber-600",
  in_progress: "border-blue-400/40 bg-blue-500/10 text-blue-600",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-600",
};

const STATUS_LABELS: Record<string, string> = {
  blocked: "Queued",
  ready: "Ready",
  assigned: "Starting",
  in_progress: "In Progress",
  completed: "Complete",
};

const POLL_INTERVAL_MS = 30_000;

function formatWhen(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function WorkRequestTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/work-requests/${id}`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load this request.");
      setTimeline(body as Timeline);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this request.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Request progress" />
        <Card title="Loading…" />
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Request progress" />
        <Card title="We couldn't load this request">
          <InlineErrorMessage message={error} />
          <div className="mt-4">
            <Link href="/customer/work-requests">
              <Button variant="ghost">Back to work orders</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isComplete = timeline.status === "completed";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={`Request ${timeline.reference}`}
        subtitle={`Submitted ${formatWhen(timeline.createdAt)}`}
        badge={
          <Badge
            className={
              isComplete
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-700"
                : undefined
            }
          >
            {timeline.completedCount} of {timeline.itemCount} complete
          </Badge>
        }
      />

      <Card
        title="Work orders"
        description="Everything in this request, and where each one has got to."
      >
        <ul className="space-y-2">
          {timeline.items.map((item, idx) => (
            <li
              key={`${item.label}-${idx}`}
              className="rounded-xl border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    STATUS_CLASSES[item.status] ?? STATUS_CLASSES.blocked
                  }`}
                >
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
                <span className="text-sm font-medium text-slate-900">
                  {item.label}
                </span>
                <span className="text-xs text-slate-400">{item.serviceName}</span>
                {item.autoIncluded ? (
                  <span className="text-[11px] text-slate-400">
                    · added as a required step
                  </span>
                ) : null}
              </div>
              {item.blockedByLabel ? (
                <p className="mt-1 text-xs text-slate-500">
                  Waiting for &quot;{item.blockedByLabel}&quot; to finish.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Progress" description="What has happened so far.">
        <ol className="space-y-3">
          {timeline.entries.map((entry, idx) => (
            <li key={`${entry.at}-${idx}`} className="flex gap-3">
              <span
                aria-hidden
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  entry.kind === "completed" || entry.kind === "request_completed"
                    ? "bg-emerald-500"
                    : entry.kind === "queued"
                      ? "bg-slate-300"
                      : "bg-cyan-500"
                }`}
              />
              <div>
                <p className="text-sm text-slate-700">{entry.message}</p>
                <p className="text-xs text-slate-400">{formatWhen(entry.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex gap-3">
        <Link href="/customer/work-requests">
          <Button variant="ghost">Request more work</Button>
        </Link>
      </div>
    </div>
  );
}

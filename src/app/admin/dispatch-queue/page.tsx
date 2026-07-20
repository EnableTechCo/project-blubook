"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGetAdminDispatchQueueQuery } from "@/store/redux/api/admin-api";

type QueueMetrics = {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
};

type QueueEvent = {
  id: string;
  event_type: string;
  status: string;
  scheduled_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
};

type QueuePayload = {
  metrics: QueueMetrics;
  events: QueueEvent[];
};

export default function AdminDispatchQueuePage() {
  const searchParams = useSearchParams();
  const statusFilter = (searchParams.get("status") ?? "all").toLowerCase();

  const queueQuery = useGetAdminDispatchQueueQuery(statusFilter || "all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const triggerDispatch = async () => {
    await fetch("/api/system/workflow/dispatch", {
      method: "POST",
      credentials: "include",
    });
    await queueQuery.refetch();
  };

  const retryEvent = async (id: string) => {
    if (retryingId) return;
    setRetryingId(id);
    try {
      await fetch(`/api/admin/dispatch-queue/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      await queueQuery.refetch();
    } finally {
      setRetryingId(null);
    }
  };

  if (queueQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading dispatch queue...</p>;
  }

  if (queueQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {queueQuery.error instanceof Error
          ? queueQuery.error.message
          : "Could not load dispatch queue."}
      </p>
    );
  }

  const data = (queueQuery.data ?? {
    metrics: {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    },
    events: [],
  }) as QueuePayload;
  const metrics = data.metrics;
  const filteredEvents = data.events;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Dispatch Queue</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Workflow event queue visibility with manual dispatch trigger.
          </p>
          {statusFilter !== "all" ? (
            <p className="mt-1 text-xs text-cyan-200">
              Filter active: status={statusFilter}
            </p>
          ) : null}
        </div>
        <Button onClick={() => void triggerDispatch()}>Run Dispatch</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Queued">
          <p className="text-3xl font-semibold text-white">{metrics.queued}</p>
        </Card>
        <Card title="Processing">
          <p className="text-3xl font-semibold text-white">
            {metrics.processing}
          </p>
        </Card>
        <Card title="Completed">
          <p className="text-3xl font-semibold text-white">
            {metrics.completed}
          </p>
        </Card>
        <Card title="Failed">
          <p className="text-3xl font-semibold text-white">{metrics.failed}</p>
        </Card>
      </div>

      <Card
        title="Recent Workflow Events"
        description="The most recent dispatch activity — see what's processing, what's queued, and anything that failed."
      >
        <div className="mb-3">
          <Badge>{filteredEvents.length} Showing</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Retries</th>
                <th className="px-3 py-2">Scheduled</th>
                <th className="px-3 py-2">Processed</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id} className="border-b border-white/10">
                  <td className="px-3 py-2">{event.event_type}</td>
                  <td className="px-3 py-2">
                    <Badge>{event.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {event.retry_count > 0
                      ? `${event.retry_count}/${event.max_retries}`
                      : "-"}
                    {event.status === "queued" && event.next_retry_at ? (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        next: {new Date(event.next_retry_at).toLocaleTimeString()}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(event.scheduled_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {event.processed_at
                      ? new Date(event.processed_at).toLocaleString()
                      : "Not processed"}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-200">
                    {event.error_message ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    {event.status === "failed" ? (
                      <Button
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={retryingId === event.id}
                        onClick={() => void retryEvent(event.id)}
                      >
                        {retryingId === event.id ? "Retrying…" : "Retry Now"}
                      </Button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-400" colSpan={7}>
                    No workflow events found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

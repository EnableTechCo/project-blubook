"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectMenu } from "@/components/ui/select-menu";
import { useGetAdminAuditLogsQuery } from "@/store/redux/api/admin-api";

type AuditLogRow = {
  id: string;
  module: "routing" | "onboarding";
  action: string;
  at: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  organizationId: string | null;
  entityType: string;
  entityId: string;
  severity: "low" | "medium" | "high";
  status: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
};

type AuditLogsPayload = {
  options: {
    modules: string[];
    actions: string[];
    actors: Array<{ userId: string; name: string }>;
    statuses: string[];
  };
  metrics: {
    total: number;
    byModule: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  logs: AuditLogRow[];
};

type Filters = {
  module: string;
  action: string;
  actor: string;
  status: string;
  q: string;
  from: string;
  to: string;
};

const DEFAULT_FILTERS: Filters = {
  module: "all",
  action: "all",
  actor: "all",
  status: "all",
  q: "",
  from: "",
  to: "",
};

const SEVERITY_CLASS: Record<string, string> = {
  high: "bg-red-500/20 text-red-200 border-red-400/40",
  medium: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  low: "bg-slate-500/20 text-slate-300 border-slate-400/40",
};

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");

    if (filters.module !== "all") params.set("module", filters.module);
    if (filters.action !== "all") params.set("action", filters.action);
    if (filters.actor !== "all") params.set("actor", filters.actor);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    return params.toString();
  }, [filters, page]);

  const logsQuery = useGetAdminAuditLogsQuery(queryString);

  const logsData = (logsQuery.data ?? {
    options: { modules: [], actions: [], actors: [], statuses: [] },
    metrics: { total: 0, byModule: {}, bySeverity: {} },
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    logs: [],
  }) as AuditLogsPayload;
  const metrics = logsData.metrics;
  const pagination = logsData.pagination;
  const logs = logsData.logs;

  const applyFilter = (key: keyof Filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  if (logsQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading audit logs...</p>;
  }

  if (logsQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {logsQuery.error instanceof Error
          ? logsQuery.error.message
          : "Could not load audit logs."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Audit Logs</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Review who changed what, when it happened, and what changed.
          </p>
        </div>
        <Badge>{metrics.total} Events</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Total Events">
          <p className="text-3xl font-semibold text-white">{metrics.total}</p>
        </Card>
        <Card title="Routing Events">
          <p className="text-3xl font-semibold text-white">
            {metrics.byModule.routing ?? 0}
          </p>
        </Card>
        <Card title="Onboarding Events">
          <p className="text-3xl font-semibold text-white">
            {metrics.byModule.onboarding ?? 0}
          </p>
        </Card>
      </div>

      <Card
        title="Filters"
        description="Filter activity by person, action, area, status, or date."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-slate-300">
            Module
            <SelectMenu
              className="mt-1"
              value={filters.module}
              onChange={(next) => applyFilter("module", next)}
              options={[
                { value: "all", label: "All Modules" },
                ...(logsData.options.modules ?? []).map((module) => ({
                  value: module,
                  label: module,
                })),
              ]}
            />
          </label>

          <label className="text-xs text-slate-300">
            Action
            <SelectMenu
              className="mt-1"
              value={filters.action}
              onChange={(next) => applyFilter("action", next)}
              options={[
                { value: "all", label: "All Actions" },
                ...(logsData.options.actions ?? []).map((action) => ({
                  value: action,
                  label: action,
                })),
              ]}
            />
          </label>

          <label className="text-xs text-slate-300">
            Actor
            <SelectMenu
              className="mt-1"
              value={filters.actor}
              onChange={(next) => applyFilter("actor", next)}
              options={[
                { value: "all", label: "All Actors" },
                ...(logsData.options.actors ?? []).map((actor) => ({
                  value: actor.userId,
                  label: actor.name,
                })),
              ]}
            />
          </label>

          <label className="text-xs text-slate-300">
            Status
            <SelectMenu
              className="mt-1"
              value={filters.status}
              onChange={(next) => applyFilter("status", next)}
              options={[
                { value: "all", label: "All Statuses" },
                ...(logsData.options.statuses ?? []).map((status) => ({
                  value: status,
                  label: status,
                })),
              ]}
            />
          </label>

          <label className="text-xs text-slate-300 xl:col-span-2">
            Search
            <input
              className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
              placeholder="Search summary, action, entity, actor..."
              value={filters.q}
              onChange={(event) => applyFilter("q", event.target.value)}
            />
          </label>

          <label className="text-xs text-slate-300">
            From
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
              value={filters.from}
              onChange={(event) => applyFilter("from", event.target.value)}
            />
          </label>

          <label className="text-xs text-slate-300">
            To
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
              value={filters.to}
              onChange={(event) => applyFilter("to", event.target.value)}
            />
          </label>
        </div>

        <div className="mt-3">
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      <Card
        title="Event Stream"
        description="A time-ordered record of what changed, who changed it, and when."
      >
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {log.action}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">{log.summary}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${
                    SEVERITY_CLASS[log.severity] ?? SEVERITY_CLASS.low
                  }`}
                >
                  {log.severity}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2 xl:grid-cols-4">
                <p>
                  <span className="text-slate-500">Module: </span>
                  {log.module}
                </p>
                <p>
                  <span className="text-slate-500">Status: </span>
                  {log.status}
                </p>
                <p>
                  <span className="text-slate-500">Actor: </span>
                  {log.actorName ?? log.actorEmail ?? "System"}
                </p>
                <p>
                  <span className="text-slate-500">At: </span>
                  {new Date(log.at).toLocaleString()}
                </p>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    Before
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-200">
                    {JSON.stringify(log.before ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    After
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-200">
                    {JSON.stringify(log.after ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}

          {logs.length === 0 ? (
            <p className="text-sm text-slate-400">
              No audit events match the current filters.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-300">
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} events)
          </p>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={pagination.page <= 1 || logsQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              disabled={
                pagination.page >= pagination.totalPages || logsQuery.isFetching
              }
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPages, current + 1),
                )
              }
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useGetAdminWorkOrdersQuery } from "@/store/redux/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type WorkOrderRow = {
  id: string;
  status: string;
  quantityToBuild: number;
  completedAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: "work_order" | "handoff";
  packageStream?: string | null;
  orderItemId?: string | null;
  salesOrderId?: string | null;
  productName: string | null;
  sku: string | null;
  itemQuantity: number | null;
  poReference: string | null;
  salesOrderStatus: string | null;
  customerName: string | null;
  poDocument?: { fileName: string; signedUrl: string } | null;
};

type WorkOrdersPayload = {
  metrics: {
    total: number;
    active: number;
    completed: number;
    blocked: number;
  };
  workOrders: WorkOrderRow[];
};

function normalize(input: string | null | undefined) {
  return (input ?? "").trim().toLowerCase();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isCompletedStatus(status: string) {
  const normalized = normalize(status);
  return (
    normalized.includes("complete") ||
    normalized.includes("done") ||
    normalized.includes("delivered")
  );
}

function isBlockedStatus(status: string) {
  const normalized = normalize(status);
  return (
    normalized.includes("reject") ||
    normalized.includes("fail") ||
    normalized.includes("blocked") ||
    normalized.includes("cancel")
  );
}

function getHealth(status: string) {
  if (isCompletedStatus(status)) {
    return "completed" as const;
  }
  if (isBlockedStatus(status)) {
    return "blocked" as const;
  }
  return "active" as const;
}

function statusTone(status: string) {
  const health = getHealth(status);
  if (health === "completed") {
    return "bg-emerald-800 text-emerald-100";
  }
  if (health === "blocked") {
    return "bg-rose-800 text-rose-100";
  }
  return "bg-blue-800 text-blue-100";
}

export default function AdminWorkOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<
    "all" | "active" | "completed" | "blocked"
  >("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const workOrdersQuery = useGetAdminWorkOrdersQuery("work-orders");

  const data = (workOrdersQuery.data ?? {
    metrics: {
      total: 0,
      active: 0,
      completed: 0,
      blocked: 0,
    },
    workOrders: [],
  }) as WorkOrdersPayload;

  const metrics = data.metrics;
  const workOrders = useMemo(() => data.workOrders, [data.workOrders]);

  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of workOrders) {
      const key = row.status || "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [
      { value: "all", label: "All statuses", count: workOrders.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [workOrders]);

  const filteredRows = useMemo(() => {
    const term = normalize(search);

    return workOrders.filter((row) => {
      if (healthFilter !== "all" && getHealth(row.status) !== healthFilter) {
        return false;
      }

      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = [
        row.productName,
        row.sku,
        row.poReference,
        row.customerName,
        row.packageStream,
        row.status,
      ]
        .map((value) => normalize(value))
        .join(" ");

      return haystack.includes(term);
    });
  }, [workOrders, search, statusFilter, healthFilter]);

  const selectedWorkOrder = useMemo(() => {
    if (!filteredRows.length) {
      return null;
    }
    if (!selectedId) {
      return filteredRows[0] ?? null;
    }
    return filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0];
  }, [filteredRows, selectedId]);

  if (workOrdersQuery.isLoading) {
    return <p className="text-sm text-slate-200">Loading work orders...</p>;
  }

  if (workOrdersQuery.isError) {
    return (
      <p className="text-sm text-red-200">
        {workOrdersQuery.error instanceof Error
          ? workOrdersQuery.error.message
          : "Could not load work orders."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Work Orders</h2>
          <p className="mt-1 text-sm text-slate-200">
            Track what is being built now, what is blocked, and what is done.
          </p>
        </div>
        <Badge>{filteredRows.length} showing</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Total" description="All current and recent work">
          <p className="text-3xl font-semibold text-white">{metrics.total}</p>
        </Card>
        <Card title="In progress" description="Work still in motion">
          <p className="text-3xl font-semibold text-white">{metrics.active}</p>
        </Card>
        <Card title="Blocked" description="Needs attention to move forward">
          <p className="text-3xl font-semibold text-white">{metrics.blocked}</p>
        </Card>
        <Card title="Done" description="Finished work items">
          <p className="text-3xl font-semibold text-white">
            {metrics.completed}
          </p>
        </Card>
      </div>

      <Card
        title="Find Work Quickly"
        description="Filter the queue by status and search by product, customer, stream, or order number."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-200">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, customer, stream, order"
              aria-label="Search work orders by product, customer, stream, or order"
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400"
            />
          </label>

          <label className="text-sm text-slate-200">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>

          <div className="text-sm text-slate-200">
            <span id="health-filter-label">Queue health</span>
            <div
              role="group"
              aria-labelledby="health-filter-label"
              className="mt-1 flex flex-wrap gap-2"
            >
              {[
                {
                  value: "all" as const,
                  label: "All",
                  count: workOrders.length,
                },
                {
                  value: "active" as const,
                  label: "In progress",
                  count: workOrders.filter(
                    (row) => getHealth(row.status) === "active",
                  ).length,
                },
                {
                  value: "blocked" as const,
                  label: "Blocked",
                  count: workOrders.filter(
                    (row) => getHealth(row.status) === "blocked",
                  ).length,
                },
                {
                  value: "completed" as const,
                  label: "Done",
                  count: workOrders.filter(
                    (row) => getHealth(row.status) === "completed",
                  ).length,
                },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setHealthFilter(tab.value)}
                  aria-pressed={tab.value === healthFilter}
                  className={`rounded-full px-3 py-1 text-xs ${
                    tab.value === healthFilter
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-slate-200"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Work Queue"
        description="Select a row to inspect details and context before following up."
      >
        <div className="flex flex-col gap-4 xl:flex-row">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <table
              role="grid"
              className="w-full text-left text-sm text-slate-200"
              aria-label="Work order queue"
            >
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-300">
                  <th scope="col" className="px-3 py-2 w-[24%]">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2 w-[8%]">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-2 w-[14%]">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 w-[22%]">
                    Order
                  </th>
                  <th scope="col" className="px-3 py-2 w-[16%]">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-2 w-[16%]">
                    Last moved
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((workOrder) => {
                  const isSelected = selectedWorkOrder?.id === workOrder.id;

                  return (
                    <tr
                      key={workOrder.id}
                      onClick={() => setSelectedId(workOrder.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(workOrder.id);
                        }
                      }}
                      tabIndex={0}
                      aria-selected={isSelected}
                      aria-label={`Work order for ${workOrder.productName ?? "unknown product"}, status ${workOrder.status}`}
                      className={`cursor-pointer border-b border-white/10 outline-none transition focus-visible:ring-2 focus-visible:ring-white/70 ${
                        isSelected ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-3 py-2">
                        <p className="whitespace-normal break-words">
                          {workOrder.productName ?? "Unknown product"}
                        </p>
                        <p className="text-xs text-slate-300">
                          {workOrder.sku ?? "No SKU"}
                        </p>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {workOrder.quantityToBuild}
                        {workOrder.itemQuantity !== null
                          ? ` / ${workOrder.itemQuantity}`
                          : ""}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(
                            workOrder.status,
                          )}`}
                        >
                          {workOrder.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="whitespace-normal break-words">
                          {workOrder.poReference ?? "No order reference"}
                        </p>
                        <p className="text-xs text-slate-300">
                          {workOrder.salesOrderStatus ??
                            "Order state unavailable"}
                        </p>
                        {workOrder.poDocument ? (
                          <a
                            href={workOrder.poDocument.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Download purchase order: ${workOrder.poDocument.fileName}`}
                            className="mt-1 inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs text-slate-200 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                          >
                            <span aria-hidden="true">📎</span> PO
                          </a>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-normal break-words">
                        {workOrder.customerName ?? "Unknown"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                        {formatDateTime(
                          workOrder.updatedAt ??
                            workOrder.completedAt ??
                            workOrder.createdAt,
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-300" colSpan={6}>
                      No matching work items found for these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="w-full shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-4 xl:w-72">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-300">
              Work details
            </h3>
            {!selectedWorkOrder ? (
              <p className="mt-3 text-sm text-slate-300">
                Select a row to view order context.
              </p>
            ) : (
              <div className="mt-3 space-y-4 text-sm text-slate-200">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                    Product
                  </p>
                  <p className="mt-1 whitespace-normal break-words font-medium">
                    {selectedWorkOrder.productName ?? "Unknown product"}
                  </p>
                  <p className="text-xs text-slate-300">
                    {selectedWorkOrder.sku ?? "No SKU"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                      Qty
                    </p>
                    <p className="mt-1 tabular-nums">
                      {selectedWorkOrder.quantityToBuild}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                      Customer
                    </p>
                    <p className="mt-1 whitespace-normal break-words">
                      {selectedWorkOrder.customerName ?? "Unknown"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                    Status
                  </p>
                  <p className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(
                        selectedWorkOrder.status,
                      )}`}
                    >
                      {selectedWorkOrder.status}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                    Route
                  </p>
                  <p className="mt-1">
                    {selectedWorkOrder.packageStream ?? "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                    Order reference
                  </p>
                  <p className="mt-1 whitespace-normal break-words">
                    {selectedWorkOrder.poReference ?? "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                    Purchase order
                  </p>
                  {selectedWorkOrder.poDocument ? (
                    <a
                      href={selectedWorkOrder.poDocument.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open purchase order: ${selectedWorkOrder.poDocument.fileName}`}
                      className="mt-1 inline-flex w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <span aria-hidden="true">📎</span>
                      <span className="min-w-0 flex-1 truncate">
                        {selectedWorkOrder.poDocument.fileName}
                      </span>
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-slate-300">
                      No document on file
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                    Last updated
                  </p>
                  <p className="mt-1">
                    {formatDateTime(
                      selectedWorkOrder.updatedAt ??
                        selectedWorkOrder.completedAt,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-300">
                    Source
                  </p>
                  <p className="mt-1">
                    {selectedWorkOrder.source === "handoff"
                      ? "Workflow handoff"
                      : "Work order"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

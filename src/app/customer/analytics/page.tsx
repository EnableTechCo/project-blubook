"use client";

import { useMemo } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Chart, type ChartOptions } from "@highcharts/react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useCustomerContext } from "@/hooks/use-customer-context";
import { useGetCustomerRequestsQuery } from "@/store/redux/api/customer-api";

// Helper function to get status color for visual feedback
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    completed: "bg-emerald-500",
    in_progress: "bg-blue-500",
    pending: "bg-blue-500",
    review: "bg-purple-500",
    triaged: "bg-cyan-500",
    submitted: "bg-blue-500",
    cancelled: "bg-red-500",
    open: "bg-cyan-500",
  };
  return colors[status] || "bg-coral";
};

// Clickable KPI Card Component
const ClickableKPICard = ({
  title,
  description,
  value,
  unit = "",
  valueClassName = "text-slate-900 dark:text-white",
  onClick,
  isLoading = false,
}: {
  title: string;
  description: string;
  value: string | number;
  unit?: string;
  valueClassName?: string;
  onClick: () => void;
  isLoading?: boolean;
}) => (
  <div
    className={`rounded-3xl transition-all duration-200 ${
      !isLoading
        ? "cursor-pointer hover:scale-105 hover:bg-slate-100 active:scale-95 dark:hover:bg-white/15"
        : ""
    }`}
    onClick={!isLoading ? onClick : undefined}
  >
    <Card
      className="p-6 border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-white/5"
      title={""}
    >
      <p className="text-sm uppercase tracking-wider text-slate-600 dark:text-slate-300">
        {title}
      </p>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
      <div className="mt-3 flex items-baseline gap-2">
        {isLoading ? (
          <div className="h-8 w-16 bg-white/10 rounded animate-pulse"></div>
        ) : (
          <p className={`text-3xl font-semibold ${valueClassName}`}>
            {value}
            {unit && <span className="text-lg ml-1">{unit}</span>}
          </p>
        )}
      </div>
    </Card>
  </div>
);

export default function CustomerAnalyticsPage() {
  const router = useRouter();
  const customerContext = useCustomerContext();
  const customerId = customerContext.data?.userId ?? "";

  const requestsQuery = useGetCustomerRequestsQuery(customerId, {
    skip: !customerId,
  });

  const stats = useMemo(() => {
    const items = requestsQuery.data ?? [];
    const total = items.length;
    const completed = items.filter(
      (item) => item.status === "completed",
    ).length;
    const open = items.filter(
      (item) => !["completed", "cancelled"].includes(item.status),
    ).length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgAgeDays =
      total > 0
        ? Math.round(
            items.reduce((sum, item) => {
              const ageMs = Date.now() - new Date(item.created_at).getTime();
              return sum + ageMs / (1000 * 60 * 60 * 24);
            }, 0) / total,
          )
        : 0;

    const byStatus = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});

    // Store filtered data for navigation
    const openRequests = items.filter(
      (item) => !["completed", "cancelled"].includes(item.status),
    );
    const completedRequests = items.filter(
      (item) => item.status === "completed",
    );

    return {
      total,
      completed,
      open,
      completionRate,
      avgAgeDays,
      byStatus,
      allRequests: items,
      openRequests,
      completedRequests,
    };
  }, [requestsQuery.data]);

  const navigateToRequests = (filterType: string, title: string) => {
    let dataToStore = [];

    switch (filterType) {
      case "open":
        dataToStore = stats.openRequests;
        break;
      case "completed":
        dataToStore = stats.completedRequests;
        break;
      case "all":
        dataToStore = stats.allRequests;
        break;
      default:
        dataToStore = stats.allRequests;
    }

    // Store the data in sessionStorage for the next page
    sessionStorage.setItem("filteredRequests", JSON.stringify(dataToStore));
    sessionStorage.setItem("pageTitle", title);
    sessionStorage.setItem("filterType", filterType);
    router.push("/customer/analytics/requests" as Route);
  };

  const navigateByStatus = (status: string, count: number) => {
    if (count === 0) return;
    const statusRequests = stats.allRequests.filter(
      (item) => item.status === status,
    );
    sessionStorage.setItem("filteredRequests", JSON.stringify(statusRequests));
    sessionStorage.setItem(
      "pageTitle",
      `${status.replace(/_/g, " ")} Requests`,
    );
    sessionStorage.setItem("filterType", status);
    router.push("/customer/analytics/requests" as Route);
  };

  const statusRows = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);
  const statusDistributionChartOptions = useMemo<ChartOptions>(() => {
    const categories = statusRows.map(([status]) =>
      status.replaceAll("_", " "),
    );
    const seriesData = statusRows.map(([, count]) => count);

    return {
      chart: {
        type: "column",
        backgroundColor: "transparent",
        height: 300,
        spacingTop: 8,
      },
      title: {
        text: undefined,
      },
      credits: {
        enabled: false,
      },
      legend: {
        enabled: false,
      },
      xAxis: {
        categories,
        title: { text: undefined },
        labels: {
          style: {
            color: "#334155",
            textTransform: "capitalize",
          },
        },
      },
      yAxis: {
        min: 0,
        allowDecimals: false,
        title: {
          text: "Requests",
          style: { color: "#475569" },
        },
        labels: {
          style: { color: "#475569" },
        },
        gridLineColor: "#cbd5e1",
      },
      tooltip: {
        pointFormat: "<b>{point.y}</b> request(s)",
      },
      plotOptions: {
        column: {
          borderRadius: 0,
          pointPadding: 0.12,
          borderWidth: 0,
        },
      },
      series: [
        {
          type: "column",
          name: "Requests",
          data: seriesData,
          color: "#0284c7",
        },
      ],
    };
  }, [statusRows]);

  const isLoading = customerContext.isLoading || requestsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">
              Customer Analytics
            </h2>
          </div>
          <div className="h-6 w-24 bg-white/10 rounded animate-pulse"></div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-slate-100 rounded-xl p-6 h-32 animate-pulse dark:bg-white/5"
            ></div>
          ))}
        </div>

        <div className="bg-slate-100 rounded-xl p-6 h-64 animate-pulse dark:bg-white/5"></div>
      </div>
    );
  }

  if (customerContext.isError || requestsQuery.isError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">
              Customer Analytics
            </h2>
          </div>
        </div>
        <Card
          className="p-12 bg-red-500/10 border-red-500/20 text-center"
          title={""}
        >
          <p className="text-red-300">
            Could not load customer analytics right now. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">
            Customer Analytics
          </h2>
        </div>
        <button
          type="button"
          className="rounded-full cursor-pointer transition-colors hover:bg-cyan-500/10"
          onClick={() => navigateToRequests("all", "All Requests")}
        >
          <Badge className="bg-cyan-500/20 text-black border-cyan-500/30">
            {stats.total} Requests
          </Badge>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ClickableKPICard
          title="Open Requests"
          description="Active workload"
          value={stats.open}
          onClick={() => navigateToRequests("open", "Open Requests")}
        />

        <ClickableKPICard
          title="Completion Rate"
          description="Submitted to completed"
          value={stats.completionRate}
          unit="%"
          valueClassName="text-emerald-400"
          onClick={() => navigateToRequests("all", "Completion Analytics")}
        />

        <ClickableKPICard
          title="Avg Ticket Age"
          description="Days since creation"
          value={stats.avgAgeDays}
          unit="d"
          valueClassName="text-cyan-700"
          onClick={() => navigateToRequests("all", "Ticket Age Analytics")}
        />

        <ClickableKPICard
          title="Completed"
          description="Total finished requests"
          value={stats.completed}
          valueClassName="text-rose-400"
          onClick={() => navigateToRequests("completed", "Completed Requests")}
        />
      </div>

      <Card
        title="Highcharts Status Distribution"
        description="Live request count by status, rendered with Highcharts."
        className="border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-white/5"
      >
        {statusRows.length > 0 ? (
          <Chart
            options={statusDistributionChartOptions}
            containerProps={{
              style: { width: "100%", minHeight: "300px" },
            }}
          />
        ) : (
          <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">
            No status data available yet.
          </p>
        )}
      </Card>

      <Card
        title="Status Distribution"
        description="Current request spread by status from live customer requests. Click any status to view details."
        className="border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-white/5"
      >
        <div className="mt-2 space-y-3">
          {statusRows.map(([status, count]) => {
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            const statusColor = getStatusColor(status);
            const hasData = count > 0;

            return (
              <div
                key={status}
                className={`${hasData ? "cursor-pointer hover:opacity-80 transition-opacity" : "opacity-50"}`}
                onClick={() => hasData && navigateByStatus(status, count)}
              >
                <div className="mb-1 flex items-center justify-between text-xs text-slate-700 dark:text-slate-200/90">
                  <span className="capitalize">
                    {status.replaceAll("_", " ")}
                  </span>
                  <div className="flex items-center gap-3">
                    <span>{count}</span>
                    <span className="text-slate-400 w-12 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-300 overflow-hidden dark:bg-white/10">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${statusColor}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {statusRows.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center py-8">
              No requests available for analytics yet.
            </p>
          ) : null}
        </div>
      </Card>

      {stats.open > 0 && (
        <div
          className="bg-cyan-50 rounded-xl p-4 border border-cyan-500/20 cursor-pointer hover:bg-cyan-100 transition-colors dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20"
          onClick={() => navigateToRequests("open", "Open Requests")}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl"></div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Active Requests Summary
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                You have {stats.open} open request{stats.open !== 1 ? "s" : ""}{" "}
                currently being processed. Your completion rate is{" "}
                {stats.completionRate}% with an average resolution time of{" "}
                {stats.avgAgeDays} days.
                <span className="text-cyan-400 ml-2">Click to view →</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

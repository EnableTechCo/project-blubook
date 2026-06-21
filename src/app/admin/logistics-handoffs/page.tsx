"use client";

import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useGetAdminLogisticsHandoffsQuery } from "@/store/redux/api/admin-api";

type LogisticsHandoffRow = {
  id: string;
  poReference: string | null;
  salesOrderId: string | null;
  salesOrderStatus: string | null;
  fromProviderName: string | null;
  toProviderName: string | null;
  handoffType: string | null;
  packageStream: string | null;
  status: string;
  assignedAt: string | null;
};

type LogisticsHandoffsPayload = {
  metrics: {
    total: number;
    pending: number;
    accepted: number;
    inProgress: number;
    completed: number;
  };
  handoffs: LogisticsHandoffRow[];
};

export default function AdminLogisticsHandoffsPage() {
  const searchParams = useSearchParams();
  const statusFilter = (searchParams.get("status") ?? "all").toLowerCase();
  const staleOnly = searchParams.get("stale") === "1";

  const queryString = new URLSearchParams();
  if (statusFilter !== "all") queryString.set("status", statusFilter);
  if (staleOnly) queryString.set("stale", "1");

  const handoffsQuery = useGetAdminLogisticsHandoffsQuery(
    queryString.toString() || "all",
  );

  const payload = handoffsQuery.data as LogisticsHandoffsPayload | undefined;

  if (handoffsQuery.isLoading) {
    return (
      <p className="text-sm text-slate-300">Loading logistics handoffs...</p>
    );
  }

  if (handoffsQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {handoffsQuery.error instanceof Error
          ? handoffsQuery.error.message
          : "Could not load logistics handoffs."}
      </p>
    );
  }

  const metrics = payload?.metrics ?? {
    total: 0,
    pending: 0,
    accepted: 0,
    inProgress: 0,
    completed: 0,
  };
  const filteredHandoffs = payload?.handoffs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Logistics Handoffs
          </h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Partner-to-partner handoff visibility for sales and logistics
            routing.
          </p>
          {statusFilter !== "all" || staleOnly ? (
            <p className="mt-1 text-xs text-cyan-200">
              Filter active:
              {statusFilter !== "all" ? ` status=${statusFilter}` : ""}
              {staleOnly ? " stale=1" : ""}
            </p>
          ) : null}
        </div>
        <Badge>{filteredHandoffs.length} Showing</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Pending">
          <p className="text-3xl font-semibold text-white">{metrics.pending}</p>
        </Card>
        <Card title="Accepted">
          <p className="text-3xl font-semibold text-white">
            {metrics.accepted}
          </p>
        </Card>
        <Card title="In Progress">
          <p className="text-3xl font-semibold text-white">
            {metrics.inProgress}
          </p>
        </Card>
        <Card title="Completed">
          <p className="text-3xl font-semibold text-white">
            {metrics.completed}
          </p>
        </Card>
      </div>

      <Card
        title="Recent Handoffs"
        description="Every in-flight handoff between partners — where each order is in transit and who's responsible."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {filteredHandoffs.map((handoff) => (
                <tr key={handoff.id} className="border-b border-white/10">
                  <td className="px-3 py-2">
                    <p>
                      {handoff.poReference ??
                        handoff.salesOrderId ??
                        "Unknown order"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {handoff.salesOrderStatus ?? "Unknown order status"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <p>{handoff.fromProviderName ?? "Unknown source"}</p>
                    <p className="text-xs text-slate-400">
                      to {handoff.toProviderName ?? "Unknown target"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <p>{handoff.handoffType ?? "Unknown type"}</p>
                    <p className="text-xs text-slate-400">
                      {handoff.packageStream ?? "No stream"}
                    </p>
                  </td>
                  <td className="px-3 py-2">{handoff.status}</td>
                  <td className="px-3 py-2">
                    {handoff.assignedAt
                      ? new Date(handoff.assignedAt).toLocaleString()
                      : "Not assigned"}
                  </td>
                </tr>
              ))}
              {filteredHandoffs.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-400" colSpan={5}>
                    No handoffs found.
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

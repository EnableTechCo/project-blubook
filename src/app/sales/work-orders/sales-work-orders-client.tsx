"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useGetWorkflowOrdersQuery } from "@/store/redux/api/workflow-api";

type WorkOrder = {
  id: string;
  orderId: string;
  status: string;
  packageStream: string | null;
  providerName: string;
  poReference: string;
  assignedAt: string | null;
};

export function SalesWorkOrdersClient() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "error";
    text: string;
  } | null>(null);

  const ordersQuery = useGetWorkflowOrdersQuery("sales-work-orders");

  useEffect(() => {
    if (ordersQuery.isLoading) return;
    if (ordersQuery.isError) {
      setMessage({ type: "error", text: "Failed to fetch work orders." });
      setLoading(false);
      return;
    }
    const payload = ordersQuery.data as Record<string, unknown> | undefined;
    const orders = Array.isArray(payload?.orders)
      ? (payload.orders as Array<Record<string, unknown>>)
      : [];
    const handoffsByOrderId =
      payload?.partnerHandoffsByOrderId &&
      typeof payload.partnerHandoffsByOrderId === "object"
        ? (payload.partnerHandoffsByOrderId as Record<string, unknown[]>)
        : {};
    const nextWorkOrders: WorkOrder[] = orders.flatMap((order) => {
      const orderId =
        order && typeof order === "object" && "id" in order
          ? String(order.id)
          : "";
      const poReference =
        order && typeof order === "object" && "po_reference" in order
          ? String(order.po_reference ?? "No PO Ref")
          : "No PO Ref";
      const handoffs = handoffsByOrderId[orderId] ?? [];
      return handoffs.map((handoff) => {
        const safeHandoff =
          handoff && typeof handoff === "object"
            ? (handoff as Record<string, unknown>)
            : {};
        const metadata =
          safeHandoff.metadata && typeof safeHandoff.metadata === "object"
            ? (safeHandoff.metadata as Record<string, unknown>)
            : null;
        const providerName =
          typeof metadata?.provider_name === "string" &&
          metadata.provider_name.trim().length > 0
            ? metadata.provider_name.trim()
            : "Assigned Partner";
        return {
          id: String(safeHandoff.id ?? ""),
          orderId,
          status: String(safeHandoff.status ?? "pending"),
          packageStream:
            typeof safeHandoff.package_stream === "string"
              ? safeHandoff.package_stream
              : null,
          providerName,
          poReference,
          assignedAt:
            typeof safeHandoff.assigned_at === "string"
              ? safeHandoff.assigned_at
              : null,
        };
      });
    });
    setWorkOrders(nextWorkOrders);
    setLoading(false);
  }, [ordersQuery.data, ordersQuery.isLoading, ordersQuery.isError]);

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-300">
        Loading work orders...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-4 rounded-2xl border text-sm transition-all bg-red-500/10 border-red-500/30 text-red-300">
          {message.text}
        </div>
      )}

      <Card
        title="Active Production Queue"
        description="Manage shopfloor operations and record progress."
      >
        {workOrders.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">
            No logistics work orders found yet for this sales organization.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 font-mono">Order ID</th>
                  <th className="py-3">PO Reference</th>
                  <th className="py-3">Partner</th>
                  <th className="py-3">Package Stream</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => {
                  const assignedLabel = wo.assignedAt
                    ? new Date(wo.assignedAt).toLocaleString()
                    : "-";

                  return (
                    <tr
                      key={wo.id}
                      className="border-b border-white/5 text-slate-200 hover:bg-white/5"
                    >
                      <td className="py-4 font-mono text-slate-300">
                        {wo.orderId}
                      </td>
                      <td className="py-4 font-semibold text-white">
                        {wo.poReference}
                      </td>
                      <td className="py-4">{wo.providerName}</td>
                      <td className="py-4">{wo.packageStream ?? "-"}</td>
                      <td className="py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] uppercase ${
                            wo.status === "completed"
                              ? "bg-green-500/10 border-green-500/20 text-green-300"
                              : wo.status === "in_progress"
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                                : wo.status === "accepted"
                                  ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                                  : wo.status === "rejected"
                                    ? "bg-red-500/10 border-red-500/20 text-red-300"
                                    : wo.status === "pending"
                                      ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
                                      : "bg-slate-500/10 border-slate-400/20 text-slate-300"
                          }`}
                        >
                          {wo.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 text-slate-300">{assignedLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

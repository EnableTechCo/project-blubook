"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProviderHandoff = {
  id: string;
  handoff_type: string | null;
  status: "pending" | "accepted" | "in_progress" | "completed" | "rejected";
  package_stream: string;
  notes: string | null;
  assigned_at: string;
  metadata: {
    source_provider_name?: string | null;
    target_provider_name?: string | null;
  } | null;
  sales_order_items: {
    product_name: string;
    sku: string;
    quantity: number;
    sales_orders: {
      po_reference: string | null;
      status: string;
    } | null;
  } | null;
};

function PartnerWorkOrdersLoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="surface rounded-2xl p-5 shadow-panel">
        <div className="h-6 w-56 rounded bg-white/10" />
        <div className="mt-2 h-4 w-80 max-w-[90%] rounded bg-white/10" />

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10">
                {Array.from({ length: 7 }).map((_, index) => (
                  <th key={`header-skeleton-${index}`} className="py-3">
                    <div className="h-3 w-16 rounded bg-white/10" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <tr
                  key={`row-skeleton-${rowIndex}`}
                  className="border-b border-white/5"
                >
                  <td className="py-4">
                    <div className="h-3 w-20 rounded bg-white/10" />
                  </td>
                  <td className="py-4">
                    <div className="h-3 w-32 rounded bg-white/10" />
                  </td>
                  <td className="py-4">
                    <div className="h-3 w-20 rounded bg-white/10" />
                  </td>
                  <td className="py-4 text-center">
                    <div className="mx-auto h-3 w-8 rounded bg-white/10" />
                  </td>
                  <td className="py-4">
                    <div className="h-3 w-24 rounded bg-white/10" />
                  </td>
                  <td className="py-4">
                    <div className="h-5 w-20 rounded-full bg-white/10" />
                  </td>
                  <td className="py-4 text-right">
                    <div className="ml-auto h-8 w-24 rounded-xl bg-white/10" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PartnerWorkOrdersClient() {
  const [inboundProviderHandoffs, setInboundProviderHandoffs] = useState<
    ProviderHandoff[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    void fetchHandoffs();
  }, []);

  async function fetchHandoffs() {
    setLoading(true);
    const response = await fetch("/api/partner/work-orders", { method: "GET" });
    const body = await response.json();

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body?.error || "Could not load work orders.",
      });
      setLoading(false);
      return;
    }

    setInboundProviderHandoffs(body?.inboundProviderHandoffs ?? []);
    setLoading(false);
  }

  async function submitAction(input: {
    id: string;
    action: "accept" | "reject" | "start" | "complete";
  }) {
    setProcessingId(input.id);
    const response = await fetch("/api/partner/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerHandoffId: input.id,
        action: input.action,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body?.error || "Could not update work order.",
      });
      setProcessingId(null);
      return;
    }

    setMessage({
      type: "success",
      text:
        input.action === "accept"
          ? "Work order accepted."
          : input.action === "start"
            ? "Work started."
            : input.action === "complete"
              ? "Work marked complete."
              : "Work order rejected.",
    });
    await fetchHandoffs();
    setProcessingId(null);
  }

  const inboundBadgeTone: Record<ProviderHandoff["status"], string> = {
    pending: "bg-amber-500/10 border-amber-400/30 text-amber-200",
    accepted: "bg-cyan-500/10 border-cyan-400/30 text-cyan-200",
    in_progress: "bg-blue-500/10 border-blue-400/30 text-blue-200",
    completed: "bg-green-500/10 border-green-400/30 text-green-200",
    rejected: "bg-red-500/10 border-red-400/30 text-red-200",
  };

  if (loading) {
    return <PartnerWorkOrdersLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            message.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <Card
        title="Inbound Provider Handoffs"
        description="Sales-to-logistics handoffs appear here. Before marking complete, upload both Shipping label and Proof of delivery in Partner Workspace Documents."
      >
        {inboundProviderHandoffs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            No inbound provider handoffs yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-3">PO</th>
                  <th className="py-3">From</th>
                  <th className="py-3">Product</th>
                  <th className="py-3">Stream</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inboundProviderHandoffs.map((handoff) => {
                  const item = handoff.sales_order_items;
                  const poRef = item?.sales_orders?.po_reference || "No PO Ref";
                  return (
                    <tr
                      key={handoff.id}
                      className="border-b border-white/5 text-slate-200 hover:bg-white/5"
                    >
                      <td className="py-4 font-semibold text-white">{poRef}</td>
                      <td className="py-4">
                        {handoff.metadata?.source_provider_name || "Sales"}
                      </td>
                      <td className="py-4">
                        {item?.product_name || "Unknown Product"}
                      </td>
                      <td className="py-4">{handoff.package_stream}</td>
                      <td className="py-4">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] uppercase ${inboundBadgeTone[handoff.status]}`}
                        >
                          {handoff.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {handoff.status === "pending" ? (
                            <>
                              <Button
                                disabled={processingId === handoff.id}
                                onClick={() =>
                                  void submitAction({
                                    id: handoff.id,
                                    action: "accept",
                                  })
                                }
                              >
                                Accept
                              </Button>
                              <Button
                                variant="danger"
                                disabled={processingId === handoff.id}
                                onClick={() =>
                                  void submitAction({
                                    id: handoff.id,
                                    action: "reject",
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {handoff.status === "accepted" ? (
                            <Button
                              disabled={processingId === handoff.id}
                              onClick={() =>
                                void submitAction({
                                  id: handoff.id,
                                  action: "start",
                                })
                              }
                            >
                              Start Work
                            </Button>
                          ) : null}
                          {handoff.status === "in_progress" ? (
                            <Button
                              className="bg-green-600 text-white hover:bg-green-500"
                              disabled={processingId === handoff.id}
                              onClick={() =>
                                void submitAction({
                                  id: handoff.id,
                                  action: "complete",
                                })
                              }
                            >
                              Mark Complete
                            </Button>
                          ) : null}
                          {handoff.status === "completed" ? (
                            <span className="text-xs italic text-slate-400">
                              Completed
                            </span>
                          ) : null}
                          {handoff.status === "rejected" ? (
                            <span className="text-xs italic text-red-300">
                              Rejected
                            </span>
                          ) : null}
                        </div>
                      </td>
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

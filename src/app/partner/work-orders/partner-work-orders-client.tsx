"use client";

import type { Route } from "next";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  WorkflowProgress,
  getWorkflowStageIndexFromHandoffStatus,
  getWorkflowStageIndexFromSalesOrder,
} from "@/components/ui/workflow-progress";
import { getStreamDisplayName } from "@/constants/stream-display";
import { WORKFLOW_ACTION_LABELS } from "@/constants/workflow-stage-labels";
import { useRealtimeEventStatus } from "@/hooks/use-realtime-event-status";
import { subscribeToPartnerWorkOrders } from "@/services/workflow-realtime.service";
import { WorkflowStepInputModal } from "@/components/ui/workflow-step-input-modal";
import { getWorkflowStep } from "@/lib/workflow/workflow-step-contract";

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
    service_level?: string | null;
    special_handling_flags?: string[];
    delivery_window_preference?: string | null;
    handoff_actor_notes?: string | null;
  } | null;
  sales_order_items: {
    product_name: string;
    sku: string;
    quantity: number;
    sales_orders: {
      id: string;
      po_reference: string | null;
      status: string;
      metadata: unknown;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inboundProviderHandoffs, setInboundProviderHandoffs] = useState<
    ProviderHandoff[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const {
    lastRealtimeEventAt,
    realtimeStatusClassName,
    realtimeStatusLabel,
    markRealtimeEvent,
  } = useRealtimeEventStatus();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [missingDocumentKeys, setMissingDocumentKeys] = useState<string[]>([]);
  const [missingDocumentHandoffId, setMissingDocumentHandoffId] = useState<
    string | null
  >(null);
  const [autoRetryTriggered, setAutoRetryTriggered] = useState(false);

  const retryCompleteId = searchParams.get("retryCompleteId") ?? "";
  const shouldRetryComplete = searchParams.get("retryComplete") === "1";

  const HANDOFF_ACTION_STEP_KEYS: Record<string, string> = {
    accept: "order_received",
    start: "order_transmitted_to_warehouse",
    complete: "customer_receives_signs_pod",
  };

  const [pendingWorkOrderAction, setPendingWorkOrderAction] = useState<{
    handoffId: string;
    action: "accept" | "reject" | "start" | "complete";
    stepKey: string;
    label: string;
    salesOrderId: string;
  } | null>(null);

  useEffect(() => {
    void fetchHandoffs();

    const unsubscribe = subscribeToPartnerWorkOrders(() => {
      markRealtimeEvent();
      void fetchHandoffs();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  async function fetchHandoffs() {
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
    // For actions that map to contract steps with required input fields,
    // intercept and show the modal first; modal calls submitActionCore on confirm.
    if (input.action !== "reject") {
      const stepKey = HANDOFF_ACTION_STEP_KEYS[input.action] ?? "";
      const contractStep = stepKey ? getWorkflowStep(stepKey) : null;
      const hasRequired =
        contractStep?.inputFields.some((f) => f.required) ?? false;

      if (hasRequired) {
        const handoff = inboundProviderHandoffs.find((h) => h.id === input.id);
        const salesOrderId = handoff?.sales_order_items?.sales_orders?.id ?? "";
        const label =
          input.action === "accept"
            ? WORKFLOW_ACTION_LABELS.logisticsConfirmHandoff
            : input.action === "start"
              ? WORKFLOW_ACTION_LABELS.logisticsActivate
              : WORKFLOW_ACTION_LABELS.logisticsDeliver;
        setPendingWorkOrderAction({
          handoffId: input.id,
          action: input.action,
          stepKey,
          label,
          salesOrderId,
        });
        return;
      }
    }
    await submitActionCore(input);
  }

  async function submitActionCore(input: {
    id: string;
    action: "accept" | "reject" | "start" | "complete";
    inputData?: Record<string, unknown>;
    actorNotes?: string;
    salesOrderId?: string;
  }): Promise<string | null> {
    setProcessingId(input.id);
    // Persist step inputs before advancing if provided
    if (
      input.inputData &&
      Object.keys(input.inputData).length > 0 &&
      input.salesOrderId &&
      HANDOFF_ACTION_STEP_KEYS[input.action]
    ) {
      const stepKey = HANDOFF_ACTION_STEP_KEYS[input.action];
      const inputRes = await fetch(
        `/api/orders/${input.salesOrderId}/step-inputs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepKey,
            inputData: input.inputData,
            actorNotes: input.actorNotes ?? null,
          }),
        },
      );
      if (!inputRes.ok) {
        const inputBody = await inputRes.json().catch(() => null);
        setProcessingId(null);
        const errMsg = inputBody?.error ?? "Could not save step inputs.";
        setMessage({ type: "error", text: errMsg });
        return errMsg;
      }
    }
    const response = await fetch("/api/partner/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerHandoffId: input.id,
        action: input.action,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
      missingDocumentKeys?: string[];
      uploadPath?: string;
    } | null;

    if (!response.ok) {
      if (
        body?.code === "MISSING_REQUIRED_DOCUMENTS" &&
        Array.isArray(body.missingDocumentKeys)
      ) {
        setMissingDocumentKeys(
          body.missingDocumentKeys.filter(
            (value): value is string => typeof value === "string",
          ),
        );
        setMissingDocumentHandoffId(input.id);
      } else {
        setMissingDocumentKeys([]);
        setMissingDocumentHandoffId(null);
      }

      setMessage({
        type: "error",
        text: body?.error || "Could not update work order.",
      });
      setProcessingId(null);
      return body?.error ?? "Could not update work order.";
    }

    setMissingDocumentKeys([]);
    setMissingDocumentHandoffId(null);

    setMessage({
      type: "success",
      text:
        input.action === "accept"
          ? "Handoff confirmed."
          : input.action === "start"
            ? "Work started."
            : input.action === "complete"
              ? "Work marked complete."
              : "Work order rejected.",
    });
    // Wait a bit for DB sync before refetching
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fetchHandoffs();
    setProcessingId(null);
    return null;
  }

  useEffect(() => {
    if (
      loading ||
      autoRetryTriggered ||
      !shouldRetryComplete ||
      !retryCompleteId
    ) {
      return;
    }

    const handoff = inboundProviderHandoffs.find(
      (item) => item.id === retryCompleteId,
    );

    setAutoRetryTriggered(true);

    if (!handoff) {
      setMessage({
        type: "error",
        text: "Could not find the work order to auto-complete. Please complete it manually.",
      });
      return;
    }

    if (handoff.status !== "in_progress") {
      setMessage({
        type: "error",
        text: `Work order is not ${WORKFLOW_ACTION_LABELS.logisticsActivate.toLowerCase()} yet. Move it to ${WORKFLOW_ACTION_LABELS.logisticsActivate} first, then mark ${WORKFLOW_ACTION_LABELS.logisticsDeliver} after uploads.`,
      });
      return;
    }

    setMessage({
      type: "success",
      text: "Uploads detected. Finalizing work order now...",
    });
    void submitAction({ id: retryCompleteId, action: "complete" });
  }, [
    autoRetryTriggered,
    inboundProviderHandoffs,
    loading,
    retryCompleteId,
    shouldRetryComplete,
  ]);

  const inboundBadgeTone: Record<ProviderHandoff["status"], string> = {
    pending: "bg-amber-500/10 border-amber-400/30 text-amber-200",
    accepted: "bg-cyan-500/10 border-cyan-400/30 text-cyan-200",
    in_progress: "bg-blue-500/10 border-blue-400/30 text-blue-200",
    completed: "bg-green-500/10 border-green-400/30 text-green-200",
    rejected: "bg-red-500/10 border-red-400/30 text-red-200",
  };

  const activeWorkOrders = inboundProviderHandoffs.filter((handoff) =>
    ["pending", "accepted", "in_progress"].includes(handoff.status),
  );
  const pendingWorkOrders = activeWorkOrders.filter(
    (handoff) => handoff.status === "pending",
  );
  const acceptedWorkOrders = activeWorkOrders.filter(
    (handoff) => handoff.status === "accepted",
  );
  const inProgressWorkOrders = activeWorkOrders.filter(
    (handoff) => handoff.status === "in_progress",
  );

  const workOrderHistory = inboundProviderHandoffs.filter((handoff) =>
    ["completed", "rejected"].includes(handoff.status),
  );

  if (loading) {
    return <PartnerWorkOrdersLoadingSkeleton />;
  }

  return (
    <>
      {pendingWorkOrderAction ? (
        <WorkflowStepInputModal
          stepKey={pendingWorkOrderAction.stepKey}
          orderId={pendingWorkOrderAction.salesOrderId}
          actionLabel={pendingWorkOrderAction.label}
          onClose={() => setPendingWorkOrderAction(null)}
          onConfirm={async (inputData, actorNotes) => {
            const err = await submitActionCore({
              id: pendingWorkOrderAction.handoffId,
              action: pendingWorkOrderAction.action,
              inputData,
              actorNotes,
              salesOrderId: pendingWorkOrderAction.salesOrderId,
            });
            if (!err) setPendingWorkOrderAction(null);
            return err;
          }}
        />
      ) : null}
      <div className="space-y-6">
        <p className={`text-[11px] ${realtimeStatusClassName}`}>
          Last realtime event:{" "}
          {lastRealtimeEventAt
            ? new Date(lastRealtimeEventAt).toLocaleString()
            : "-"}{" "}
          • {realtimeStatusLabel}
        </p>
        {message ? (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              message.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            <p>{message.text}</p>
            {message.type === "error" && missingDocumentKeys.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="h-8 rounded-md bg-cyan-500/90 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                  onClick={() => {
                    const query = new URLSearchParams();
                    query.set("missing", missingDocumentKeys.join(","));
                    if (missingDocumentHandoffId) {
                      query.set("retryComplete", "1");
                      query.set("retryCompleteId", missingDocumentHandoffId);
                    }

                    const target = `/partner/documents?${query.toString()}`;
                    router.push(target as Route);
                  }}
                >
                  Upload Missing Documents
                </Button>
                <p className="text-xs text-red-100/90">
                  Missing: {missingDocumentKeys.join(", ")}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeWorkOrders.length > 0 ? (
          <section
            className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-4"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-cyan-100">
              Inbound Logistics Handoffs
            </p>
            <p className="mt-1 text-xs text-cyan-50/90">
              {pendingWorkOrders.length > 0
                ? `${pendingWorkOrders.length} handoff${pendingWorkOrders.length === 1 ? "" : "s"} waiting acceptance.`
                : `${activeWorkOrders.length} active handoff${activeWorkOrders.length === 1 ? "" : "s"} in execution.`}
            </p>
            <p className="mt-1 text-[11px] text-cyan-50/85">
              Accepted: {acceptedWorkOrders.length} • In Progress:{" "}
              {inProgressWorkOrders.length}
            </p>

            <div className="mt-4 space-y-4">
              {activeWorkOrders.map((handoff) => {
                const item = handoff.sales_order_items;
                const poRef = item?.sales_orders?.po_reference || "No PO Ref";
                const flowStatus =
                  item?.sales_orders?.status?.replaceAll("_", " ") ||
                  handoff.status.replaceAll("_", " ");
                const handlingFlags = Array.isArray(
                  handoff.metadata?.special_handling_flags,
                )
                  ? (handoff.metadata?.special_handling_flags ?? [])
                  : [];

                return (
                  <div
                    key={`banner-${handoff.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {poRef}
                        </p>
                        <p className="text-[11px] text-slate-300">
                          From{" "}
                          {handoff.metadata?.source_provider_name || "Sales"}
                        </p>
                      </div>

                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] uppercase ${inboundBadgeTone[handoff.status]}`}
                      >
                        {flowStatus}
                      </span>
                    </div>

                    <p className="mb-3 text-[11px] text-slate-300">
                      Use the actions table below for all state transitions.
                    </p>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {handoff.metadata?.service_level ? (
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-2 py-0.5 text-[10px] text-cyan-100">
                          SLA: {handoff.metadata.service_level}
                        </span>
                      ) : null}
                      {handoff.metadata?.delivery_window_preference ? (
                        <span className="rounded-full border border-white/15 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200">
                          Window: {handoff.metadata.delivery_window_preference}
                        </span>
                      ) : null}
                      {handlingFlags.map((flag) => (
                        <span
                          key={`${handoff.id}-${flag}`}
                          className="rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-100"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>

                    {handoff.metadata?.handoff_actor_notes ? (
                      <p className="mb-3 text-[11px] text-slate-300">
                        Sales Notes: {handoff.metadata.handoff_actor_notes}
                      </p>
                    ) : null}

                    <WorkflowProgress
                      variant="sales"
                      compact={false}
                      currentIndex={getWorkflowStageIndexFromSalesOrder({
                        status:
                          handoff.sales_order_items?.sales_orders?.status ?? "",
                        timeline: (
                          handoff.sales_order_items?.sales_orders
                            ?.metadata as any
                        )?.workflow_timeline,
                      })}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <Card
          title="Logistics Work Orders"
          description="Sales-to-logistics assignments appear here as actionable work orders. Before marking complete, upload both Shipping label and Proof of delivery in Partner Workspace Documents."
        >
          {activeWorkOrders.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              No active work orders yet.
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
                  {activeWorkOrders.map((handoff) => {
                    const item = handoff.sales_order_items;
                    const poRef =
                      item?.sales_orders?.po_reference || "No PO Ref";
                    return (
                      <tr
                        key={handoff.id}
                        className="border-b border-white/5 text-slate-200 hover:bg-white/5"
                      >
                        <td className="py-4 font-semibold text-white">
                          {poRef}
                        </td>
                        <td className="py-4">
                          {handoff.metadata?.source_provider_name || "Sales"}
                        </td>
                        <td className="py-4">
                          {item?.product_name || "Unknown Product"}
                        </td>
                        <td className="py-4">
                          {getStreamDisplayName(handoff.package_stream)}
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] uppercase ${inboundBadgeTone[handoff.status]}`}
                          >
                            {item?.sales_orders?.status?.replaceAll("_", " ") ||
                              handoff.status.replaceAll("_", " ")}
                          </span>
                          <div className="mt-2 max-w-[260px]">
                            <WorkflowProgress
                              variant="sales"
                              compact
                              currentIndex={getWorkflowStageIndexFromSalesOrder(
                                {
                                  status:
                                    handoff.sales_order_items?.sales_orders
                                      ?.status ?? "",
                                  timeline: (
                                    handoff.sales_order_items?.sales_orders
                                      ?.metadata as any
                                  )?.workflow_timeline,
                                },
                              )}
                            />
                          </div>
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
                                  {
                                    WORKFLOW_ACTION_LABELS.logisticsConfirmHandoff
                                  }
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
                                {WORKFLOW_ACTION_LABELS.logisticsActivate}
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
                                {WORKFLOW_ACTION_LABELS.logisticsDeliver}
                              </Button>
                            ) : null}
                            {handoff.status === "completed" ? (
                              <span className="text-xs italic text-slate-400">
                                {WORKFLOW_ACTION_LABELS.logisticsDeliver}
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

        <Card
          title="Work Order History"
          description="Recently completed or rejected logistics work orders."
        >
          {workOrderHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No completed or rejected work orders yet.
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
                  </tr>
                </thead>
                <tbody>
                  {workOrderHistory.map((handoff) => {
                    const item = handoff.sales_order_items;
                    const poRef =
                      item?.sales_orders?.po_reference || "No PO Ref";
                    return (
                      <tr
                        key={`history-${handoff.id}`}
                        className="border-b border-white/5 text-slate-200 hover:bg-white/5"
                      >
                        <td className="py-4 font-semibold text-white">
                          {poRef}
                        </td>
                        <td className="py-4">
                          {handoff.metadata?.source_provider_name || "Sales"}
                        </td>
                        <td className="py-4">
                          {item?.product_name || "Unknown Product"}
                        </td>
                        <td className="py-4">
                          {getStreamDisplayName(handoff.package_stream)}
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] uppercase ${inboundBadgeTone[handoff.status]}`}
                          >
                            {item?.sales_orders?.status?.replaceAll("_", " ") ||
                              handoff.status.replaceAll("_", " ")}
                          </span>
                          <div className="mt-2 max-w-[260px]">
                            <WorkflowProgress
                              variant="sales"
                              compact
                              currentIndex={getWorkflowStageIndexFromSalesOrder(
                                {
                                  status:
                                    handoff.sales_order_items?.sales_orders
                                      ?.status ?? "",
                                  timeline: (
                                    handoff.sales_order_items?.sales_orders
                                      ?.metadata as any
                                  )?.workflow_timeline,
                                },
                              )}
                            />
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
    </>
  );
}

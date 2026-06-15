"use client";

import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  WorkflowProgress,
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

const HANDOFF_ACTION_STEP_KEYS: Record<string, string> = {
  accept: "order_received",
  start: "order_transmitted_to_warehouse",
  complete: "customer_receives_signs_pod",
};

type TimelineEntry = {
  step?: string;
};

function readWorkflowTimeline(metadata: unknown): TimelineEntry[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const timeline = (metadata as { workflow_timeline?: unknown })
    .workflow_timeline;
  if (!Array.isArray(timeline)) {
    return [];
  }

  return timeline.filter(
    (entry): entry is TimelineEntry =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
  );
}

function formatCheckpoint(stepKey: string) {
  return stepKey
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

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
  const [outboundProviderHandoffs, setOutboundProviderHandoffs] = useState<
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

  const [expandedHandoffId, setExpandedHandoffId] = useState<string | null>(
    null,
  );
  const [handoffStepEvents, setHandoffStepEvents] = useState<
    Record<
      string,
      {
        loading: boolean;
        steps: Array<{
          key: string;
          label: string;
          completed: boolean;
          current: boolean;
        }>;
        events: Array<{
          step_key: string;
          created_at: string;
          actor_type: string | null;
        }>;
      }
    >
  >({});

  async function loadHandoffStepEvents(handoff: ProviderHandoff) {
    const orderId = handoff.sales_order_items?.sales_orders?.id;
    if (!orderId) return;
    setHandoffStepEvents((prev) => ({
      ...prev,
      [handoff.id]: { loading: true, steps: [], events: [] },
    }));
    try {
      const res = await fetch(
        `/api/orders/${orderId}/step-events?audience=logistics`,
      );
      const body = await res.json().catch(() => null);
      setHandoffStepEvents((prev) => ({
        ...prev,
        [handoff.id]: {
          loading: false,
          steps: Array.isArray(body?.steps) ? body.steps : [],
          events: Array.isArray(body?.events) ? body.events : [],
        },
      }));
    } catch {
      setHandoffStepEvents((prev) => ({
        ...prev,
        [handoff.id]: { loading: false, steps: [], events: [] },
      }));
    }
  }

  function toggleExpanded(handoff: ProviderHandoff) {
    if (expandedHandoffId === handoff.id) {
      setExpandedHandoffId(null);
    } else {
      setExpandedHandoffId(handoff.id);
      if (!handoffStepEvents[handoff.id]) void loadHandoffStepEvents(handoff);
    }
  }

  const retryCompleteId = searchParams.get("retryCompleteId") ?? "";
  const shouldRetryComplete = searchParams.get("retryComplete") === "1";

  const [pendingWorkOrderAction, setPendingWorkOrderAction] = useState<{
    handoffId: string;
    action: "accept" | "reject" | "start" | "complete";
    stepKey: string;
    label: string;
    salesOrderId: string;
  } | null>(null);

  const fetchHandoffs = useCallback(async () => {
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
    setOutboundProviderHandoffs(body?.outboundProviderHandoffs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchHandoffs();

    const unsubscribe = subscribeToPartnerWorkOrders(() => {
      markRealtimeEvent();
      void fetchHandoffs();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchHandoffs, markRealtimeEvent]);

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

  const submitActionCore = useCallback(
    async (input: {
      id: string;
      action: "accept" | "reject" | "start" | "complete";
      inputData?: Record<string, unknown>;
      actorNotes?: string;
      salesOrderId?: string;
    }): Promise<string | null> => {
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
              ? "Warehouse processing started."
              : input.action === "complete"
                ? "Work marked complete."
                : "Work order rejected.",
      });
      // Wait a bit for DB sync before refetching
      await new Promise((resolve) => setTimeout(resolve, 300));
      await fetchHandoffs();
      setProcessingId(null);
      return null;
    },
    [fetchHandoffs],
  );

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
    void submitActionCore({ id: retryCompleteId, action: "complete" });
  }, [
    autoRetryTriggered,
    inboundProviderHandoffs,
    loading,
    retryCompleteId,
    submitActionCore,
    shouldRetryComplete,
  ]);

  const inboundBadgeTone: Record<ProviderHandoff["status"], string> = {
    pending: "bg-amber-500/10 border-amber-400/30 text-slate-200",
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

  const outboundWorkOrderHistory = outboundProviderHandoffs.filter((handoff) =>
    ["completed", "rejected"].includes(handoff.status),
  );
  const outboundActiveWorkOrders = outboundProviderHandoffs.filter((handoff) =>
    ["pending", "accepted", "in_progress"].includes(handoff.status),
  );

  const workOrderHistory = [
    ...inboundProviderHandoffs.filter((handoff) =>
      ["completed", "rejected"].includes(handoff.status),
    ),
    ...outboundWorkOrderHistory,
  ];

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
            <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-100">
              Inbound Logistics Handoffs
            </p>
            <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-50/90">
              {pendingWorkOrders.length > 0
                ? `${pendingWorkOrders.length} handoff${pendingWorkOrders.length === 1 ? "" : "s"} waiting acceptance.`
                : `${activeWorkOrders.length} active handoff${activeWorkOrders.length === 1 ? "" : "s"} in execution.`}
            </p>
            <p className="mt-1 text-[11px] text-cyan-700 dark:text-cyan-50/85">
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
                    className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    {(() => {
                      const orderTimeline = readWorkflowTimeline(
                        handoff.sales_order_items?.sales_orders?.metadata,
                      );
                      return (
                        <>
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                {poRef}
                              </p>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                From{" "}
                                {handoff.metadata?.source_provider_name ||
                                  "Sales"}
                              </p>
                            </div>

                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] uppercase ${inboundBadgeTone[handoff.status]}`}
                            >
                              {flowStatus}
                            </span>
                          </div>

                          <p className="mb-3 text-[11px] text-slate-600 dark:text-slate-300">
                            Use the actions table below for all state
                            transitions.
                          </p>

                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {handoff.metadata?.service_level ? (
                              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-2 py-0.5 text-[10px] text-cyan-100">
                                SLA: {handoff.metadata.service_level}
                              </span>
                            ) : null}
                            {handoff.metadata?.delivery_window_preference ? (
                              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200">
                                Window:{" "}
                                {handoff.metadata.delivery_window_preference}
                              </span>
                            ) : null}
                            {handlingFlags.map((flag) => (
                              <span
                                key={`${handoff.id}-${flag}`}
                                className="rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-0.5 text-[10px] text-slate-100"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>

                          {handoff.metadata?.handoff_actor_notes ? (
                            <p className="mb-3 text-[11px] text-slate-600 dark:text-slate-300">
                              Sales Notes:{" "}
                              {handoff.metadata.handoff_actor_notes}
                            </p>
                          ) : null}

                          <WorkflowProgress
                            variant="sales"
                            compact={false}
                            currentIndex={getWorkflowStageIndexFromSalesOrder({
                              status:
                                handoff.sales_order_items?.sales_orders
                                  ?.status ?? "",
                              timeline: orderTimeline,
                            })}
                          />
                        </>
                      );
                    })()}
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
                  <tr className="border-b border-slate-300 text-[10px] uppercase tracking-wider text-slate-600 dark:border-white/10 dark:text-slate-400">
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
                    const orderTimeline = readWorkflowTimeline(
                      handoff.sales_order_items?.sales_orders?.metadata,
                    );
                    const latestStep = orderTimeline
                      .map((entry) => entry.step)
                      .filter(
                        (step): step is string =>
                          typeof step === "string" && step.length > 0,
                      )
                      .slice(-1)[0];
                    return (
                      <tr
                        key={handoff.id}
                        className="border-b border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/5 dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        <td className="py-4 font-semibold text-slate-900 dark:text-white">
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
                          <p className="mt-1 text-[11px] text-slate-500">
                            Latest checkpoint:{" "}
                            {latestStep
                              ? formatCheckpoint(latestStep)
                              : "Awaiting logistics checkpoints"}
                          </p>
                          <div className="mt-2 max-w-[260px]">
                            <WorkflowProgress
                              variant="sales"
                              compact
                              currentIndex={getWorkflowStageIndexFromSalesOrder(
                                {
                                  status:
                                    handoff.sales_order_items?.sales_orders
                                      ?.status ?? "",
                                  timeline: orderTimeline,
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
                              <>
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
                                  Return To Sales
                                </Button>
                              </>
                            ) : null}
                            {handoff.status === "in_progress" ? (
                              <>
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
                                  Return To Sales
                                </Button>
                              </>
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

        {outboundActiveWorkOrders.length > 0 ? (
          <Card
            title="Dispatched Work Orders"
            description="Logistics work orders dispatched to other partners. Track their progress here."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-[10px] uppercase tracking-wider text-slate-600 dark:border-white/10 dark:text-slate-400">
                    <th className="py-3">PO</th>
                    <th className="py-3">To Partner</th>
                    <th className="py-3">Product</th>
                    <th className="py-3">Stream</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outboundActiveWorkOrders.map((handoff) => {
                    const item = handoff.sales_order_items;
                    const poRef =
                      item?.sales_orders?.po_reference || "No PO Ref";
                    return (
                      <tr
                        key={`outbound-${handoff.id}`}
                        className="border-b border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/5 dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        <td className="py-4 font-semibold text-slate-900 dark:text-white">
                          {poRef}
                        </td>
                        <td className="py-4">
                          {handoff.metadata?.target_provider_name ||
                            "Logistics Partner"}
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
                            {handoff.status.replaceAll("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card
          title="Work Order History"
          description="Recently completed or rejected logistics work orders. Click a row to view workflow steps."
        >
          {workOrderHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No completed or rejected work orders yet.
            </p>
          ) : (
            <div className="space-y-2">
              {workOrderHistory.map((handoff) => {
                const item = handoff.sales_order_items;
                const order = item?.sales_orders;
                const poRef = order?.po_reference || "No PO Ref";
                const isCompleted = handoff.status === "completed";
                const isExpanded = expandedHandoffId === handoff.id;
                const stepData = handoffStepEvents[handoff.id];
                const assignedDate = handoff.assigned_at
                  ? new Date(handoff.assigned_at).toLocaleDateString(
                      undefined,
                      { day: "numeric", month: "short", year: "numeric" },
                    )
                  : null;

                return (
                  <div
                    key={`history-${handoff.id}`}
                    className={`rounded-xl border transition-all ${
                      isCompleted
                        ? "border-green-600/25 dark:border-green-500/20"
                        : "border-red-600/25 dark:border-red-500/20"
                    }`}
                  >
                    {/* Summary row — always visible, click to expand */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(handoff)}
                      className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                        isCompleted
                          ? "bg-green-50 hover:bg-green-100/70 dark:bg-green-500/5 dark:hover:bg-green-500/10"
                          : "bg-red-50 hover:bg-red-100/70 dark:bg-red-500/5 dark:hover:bg-red-500/10"
                      } ${isExpanded ? "rounded-t-xl" : "rounded-xl"}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isCompleted
                              ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                              : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                          }`}
                        >
                          {isCompleted ? (
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {poRef}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {item?.product_name || "Unknown Product"}
                            </span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {getStreamDisplayName(handoff.package_stream)}
                            </span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              From{" "}
                              {handoff.metadata?.source_provider_name ||
                                "Sales"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              isCompleted
                                ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300"
                                : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                            }`}
                          >
                            {handoff.status.replaceAll("_", " ")}
                          </span>
                          {assignedDate ? (
                            <p className="text-[10px] text-slate-400">
                              {assignedDate}
                            </p>
                          ) : null}
                        </div>
                        <svg
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded ? (
                      <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-white/10">
                        {/* Metadata grid */}
                        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            {
                              label: "Order ID",
                              value: order?.id
                                ? order.id.slice(0, 8) + "…"
                                : "—",
                            },
                            {
                              label: "Order Status",
                              value: order?.status?.replaceAll("_", " ") || "—",
                            },
                            { label: "SKU", value: item?.sku || "—" },
                            {
                              label: "Qty",
                              value:
                                item?.quantity != null
                                  ? String(item.quantity)
                                  : "—",
                            },
                          ].map(({ label, value }) => (
                            <div
                              key={label}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                {label}
                              </p>
                              <p className="mt-0.5 truncate text-xs font-bold text-slate-900 dark:text-white">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                        {/* Extra tags */}
                        {handoff.metadata?.service_level ||
                        handoff.metadata?.delivery_window_preference ||
                        handoff.notes ? (
                          <div className="mb-4 flex flex-wrap gap-2">
                            {handoff.metadata?.service_level ? (
                              <span className="rounded-full border border-cyan-300/40 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                                SLA: {handoff.metadata.service_level}
                              </span>
                            ) : null}
                            {handoff.metadata?.delivery_window_preference ? (
                              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-300">
                                Window:{" "}
                                {handoff.metadata.delivery_window_preference}
                              </span>
                            ) : null}
                            {handoff.notes ? (
                              <span className="rounded-full border border-amber-300/40 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                Notes: {handoff.notes}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {/* Workflow steps */}
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Workflow Steps
                        </p>
                        {stepData?.loading ? (
                          <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10"
                              />
                            ))}
                          </div>
                        ) : !stepData || stepData.steps.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No step data available for this order.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {stepData.steps.map((step) => {
                              const event = stepData.events.find(
                                (e) => e.step_key === step.key,
                              );
                              const eventDate = event?.created_at
                                ? new Date(event.created_at).toLocaleString(
                                    undefined,
                                    {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                : null;
                              return (
                                <div
                                  key={step.key}
                                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                                    step.completed
                                      ? "border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/5"
                                      : step.current
                                        ? "border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10"
                                        : "border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-white/[0.02]"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`h-2 w-2 rounded-full ${
                                        step.completed
                                          ? "bg-green-500"
                                          : step.current
                                            ? "bg-blue-500"
                                            : "bg-slate-300 dark:bg-slate-600"
                                      }`}
                                    />
                                    <span
                                      className={`text-xs font-medium ${
                                        step.completed
                                          ? "text-green-800 dark:text-green-300"
                                          : step.current
                                            ? "text-blue-800 dark:text-blue-300"
                                            : "text-slate-400"
                                      }`}
                                    >
                                      {step.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {eventDate ? (
                                      <span className="text-[10px] tabular-nums text-slate-400">
                                        {eventDate}
                                      </span>
                                    ) : null}
                                    {step.completed ? (
                                      <svg
                                        className="h-3.5 w-3.5 text-green-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    ) : step.current ? (
                                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

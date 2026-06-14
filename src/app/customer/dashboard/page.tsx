"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FileUploader } from "@/components/ui/file-uploader";
import {
  WorkflowStepMatrix,
  WorkflowProgress,
} from "@/components/ui/workflow-progress";
import { buildAudienceStepView } from "@/lib/workflow/workflow-step-contract";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { useRealtimeEventStatus } from "@/hooks/use-realtime-event-status";
import { useCustomerContext } from "@/hooks/use-customer-context";
import { listCustomerRequirements } from "@/services/requirements.service";
import requirementsService from "@/services/requirements.service";
import { subscribeToCustomerOrderProgress } from "@/services/workflow-realtime.service";

function isPendingRequirement(status: string) {
  return status === "missing" || status === "rejected";
}

function isPurchaseOrderRequirement(input: {
  title: string;
  evidenceType: string;
}) {
  const title = input.title.toLowerCase();
  const evidenceType = input.evidenceType.toLowerCase();
  return (
    title.includes("purchase order") ||
    title.includes("purchase-order") ||
    evidenceType.includes("purchase_order") ||
    (evidenceType.includes("purchase") && evidenceType.includes("order"))
  );
}

type CustomerOrderSummary = {
  id: string;
  status: string;
  poReference: string | null;
  updatedAt: string;
  timeline: Array<{ step?: string }>;
};

type UploadFlowStage =
  | "idle"
  | "ensuring_requirement"
  | "uploading_file"
  | "starting_workflow"
  | "waiting_for_order"
  | "complete"
  | "error";

export default function CustomerDashboardPage() {
  const queryClient = useQueryClient();
  const customerContext = useCustomerContext();
  const [uploadingRequirementId, setUploadingRequirementId] = useState<
    string | null
  >(null);
  const [retractConfirmOrder, setRetractConfirmOrder] = useState<{
    id: string;
    poReference: string | null;
  } | null>(null);
  const [retractingOrderId, setRetractingOrderId] = useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{
    fileName: string;
    poReference: string | null;
    orderId: string | null;
    phase: "confirmed" | "processing" | "skipped";
  } | null>(null);
  const [uploadFlowStage, setUploadFlowStage] =
    useState<UploadFlowStage>("idle");
  const [selectedUploadStepIndex, setSelectedUploadStepIndex] = useState(0);
  const [uploadStageDurationsMs, setUploadStageDurationsMs] = useState<
    Record<number, number>
  >({});
  const [uploadTimerTick, setUploadTimerTick] = useState(Date.now());
  const uploadFlowPreviousStageRef = useRef<UploadFlowStage>("idle");
  const uploadFlowCurrentStageStartedAtRef = useRef<number | null>(null);
  const {
    lastRealtimeEventAt,
    realtimeStatusClassName,
    realtimeStatusLabel,
    markRealtimeEvent,
  } = useRealtimeEventStatus();

  const organizationId = customerContext.data?.organizationId ?? "";
  const userId = customerContext.data?.userId ?? "";
  const bucket =
    process.env.NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET?.trim() || "documents";
  const prefix = `organizations/${organizationId}/customers/${userId}`;

  const requirementsQuery = useQuery({
    queryKey: ["customer-requirements", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listCustomerRequirements(organizationId),
  });

  const ordersQuery = useQuery({
    queryKey: ["customer-orders", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<Array<CustomerOrderSummary>> => {
      const response = await fetch("/api/customer/orders", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load customer orders.");
      }

      return (body?.orders ?? []) as Array<CustomerOrderSummary>;
    },
  });

  const activeOrders = (ordersQuery.data ?? []).filter(
    (order) => order.status !== "Delivered" && order.status !== "Cancelled",
  );
  const completedOrders = (ordersQuery.data ?? []).filter(
    (order) => order.status === "Delivered",
  );
  // Use the same order that the UI is rendering (active first) to avoid
  // showing step completion from a different order.
  const displayedOrderId =
    activeOrders[0]?.id ?? (ordersQuery.data ?? [])[0]?.id ?? null;

  const stepEventsQuery = useQuery({
    queryKey: ["step-events", displayedOrderId],
    enabled: Boolean(displayedOrderId),
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(
        `/api/orders/${displayedOrderId}/step-events?audience=customer`,
        { credentials: "include" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) return [];
      return (body?.completedStepKeys ?? []) as string[];
    },
  });

  const providerReadinessQuery = useQuery({
    queryKey: ["customer-provider-readiness"],
    queryFn: async (): Promise<{
      slas: { active: number; total: number };
      generatedCustomerRequests: number;
    }> => {
      const response = await fetch("/api/customer/provider-readiness", {
        method: "GET",
        credentials: "include",
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load SLA metrics.");
      }

      return {
        slas: {
          active: Number(body?.slas?.active ?? 0),
          total: Number(body?.slas?.total ?? 0),
        },
        generatedCustomerRequests: Number(body?.generatedCustomerRequests ?? 0),
      };
    },
  });

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const unsubscribe = subscribeToCustomerOrderProgress(organizationId, () => {
      markRealtimeEvent();
      void queryClient.invalidateQueries({
        queryKey: ["customer-orders", organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["customer-requirements", organizationId],
      });
      // Also refresh step-events so the progress bar updates without a manual reload.
      void queryClient.invalidateQueries({ queryKey: ["step-events"] });
    });

    return () => {
      unsubscribe();
    };
  }, [organizationId, markRealtimeEvent, queryClient]);

  const submitEvidenceMutation = useMutation({
    mutationFn: requirementsService.submitRequirementEvidence,
    onSuccess: async () => {
      setUploadError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customer-requirements", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["documents", bucket, prefix],
        }),
      ]);
    },
  });

  const retractOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/customer/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not retract order.");
      }

      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customer-orders", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer-requirements", organizationId],
        }),
      ]);
    },
  });

  const ensurePoRequirementMutation = useMutation({
    mutationFn: requirementsService.ensurePurchaseOrderRequirement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["customer-requirements", organizationId],
      });
    },
  });

  const pendingPurchaseOrders = (requirementsQuery.data ?? []).filter(
    (item) =>
      item.isRequired &&
      isPendingRequirement(item.status) &&
      isPurchaseOrderRequirement({
        title: item.title,
        evidenceType: item.evidenceType,
      }),
  );

  useEffect(() => {
    const order = (ordersQuery.data ?? [])[0];
    if (!order) {
      console.info("[CustomerDashboard] No active customer order visible", {
        orderCount: ordersQuery.data?.length ?? 0,
      });
      return;
    }

    const completedStepKeys = stepEventsQuery.data ?? [];
    const stepView = buildAudienceStepView({
      audience: "customer",
      completedStepKeys,
    });
    const currentStep = stepView.find((step) => step.current) ?? null;

    console.info("[CustomerDashboard] Visible workflow step", {
      orderId: order.id,
      poReference: order.poReference,
      orderStatus: order.status,
      currentVisibleStep: currentStep
        ? {
            key: currentStep.key,
            label: currentStep.label,
            owner: currentStep.owner,
          }
        : null,
      completedStepKeys,
      visibleSteps: stepView.map((step) => ({
        key: step.key,
        label: step.label,
        completed: step.completed,
        current: step.current,
      })),
    });
  }, [ordersQuery.data, stepEventsQuery.data]);

  async function onPurchaseOrderFileChange(
    requirementItemId: string,
    files: File[],
  ) {
    const file = files[0];
    if (!file) {
      return;
    }

    uploadFlowPreviousStageRef.current = "idle";
    uploadFlowCurrentStageStartedAtRef.current = null;
    setUploadStageDurationsMs({});
    setUploadTimerTick(Date.now());
    setUploadingRequirementId(requirementItemId);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadFlowStage("uploading_file");
    setSelectedUploadStepIndex(1);

    try {
      const result = await submitEvidenceMutation.mutateAsync({
        requirementItemId,
        bucket,
        prefix,
        file,
      });

      const kickoffOrderId = result.kickoff?.salesOrderId ?? null;
      const kickoffPoReference = result.kickoff?.poReference ?? null;
      const kickoffSkipped = result.kickoff?.skipped === true;

      if (kickoffOrderId && organizationId) {
        queryClient.setQueryData<Array<CustomerOrderSummary>>(
          ["customer-orders", organizationId],
          (current) => {
            const nextOrder: CustomerOrderSummary = {
              id: kickoffOrderId,
              status: "Purchase Order Received",
              poReference: kickoffPoReference,
              updatedAt: new Date().toISOString(),
              timeline: [],
            };

            const deduped = (current ?? []).filter(
              (order) => order.id !== kickoffOrderId,
            );
            return [nextOrder, ...deduped];
          },
        );
      }

      void queryClient.invalidateQueries({
        queryKey: ["customer-orders", organizationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["step-events"] });

      setUploadFlowStage("starting_workflow");
      setSelectedUploadStepIndex(2);

      if (kickoffOrderId || kickoffPoReference) {
        setUploadSuccess({
          fileName: file.name,
          poReference: kickoffPoReference,
          orderId: kickoffOrderId,
          phase: "confirmed",
        });
        setUploadFlowStage("waiting_for_order");
        setSelectedUploadStepIndex(3);
      } else if (kickoffSkipped) {
        setUploadSuccess({
          fileName: file.name,
          poReference: null,
          orderId: null,
          phase: "skipped",
        });
        setUploadFlowStage("complete");
        setSelectedUploadStepIndex(4);
      } else {
        setUploadSuccess({
          fileName: file.name,
          poReference: null,
          orderId: null,
          phase: "processing",
        });
        setUploadFlowStage("waiting_for_order");
        setSelectedUploadStepIndex(3);
      }
    } catch (error) {
      setUploadSuccess(null);
      setUploadFlowStage("error");
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not upload purchase order.",
      );
    } finally {
      setUploadingRequirementId(null);
    }
  }

  async function onPurchaseOrderFileChangeWithEnsure(files: File[]) {
    const file = files[0];
    if (!file) {
      return;
    }

    uploadFlowPreviousStageRef.current = "idle";
    uploadFlowCurrentStageStartedAtRef.current = null;
    setUploadStageDurationsMs({});
    setUploadTimerTick(Date.now());
    setUploadError(null);
    setUploadSuccess(null);
    setUploadFlowStage("ensuring_requirement");
    setSelectedUploadStepIndex(0);

    try {
      const result = await ensurePoRequirementMutation.mutateAsync();
      await onPurchaseOrderFileChange(result.requirementId, [file]);
    } catch (error) {
      setUploadSuccess(null);
      setUploadFlowStage("error");
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not prepare purchase order upload.",
      );
    }
  }

  function onRetractOrderRequest(orderId: string, poReference: string | null) {
    setRetractConfirmOrder({ id: orderId, poReference });
  }

  async function onRetractOrderConfirmed() {
    if (!retractConfirmOrder) {
      return;
    }

    const { id } = retractConfirmOrder;
    setRetractingOrderId(id);
    try {
      await retractOrderMutation.mutateAsync(id);
    } catch {
      // handled in UI
    } finally {
      setRetractingOrderId(null);
      setRetractConfirmOrder(null);
    }
  }

  // ── Derived UI state ────────────────────────────────────────────────────────
  const isUploading =
    uploadingRequirementId !== null ||
    ensurePoRequirementMutation.isPending ||
    submitEvidenceMutation.isPending;
  const hasActiveOrder = activeOrders.length > 0;
  const activeOrder = activeOrders[0] ?? null;
  // Show kickoff animation when upload just completed but the order hasn't
  // appeared yet (orders query still re-fetching after invalidation).
  const showKickoff = uploadSuccess !== null && !hasActiveOrder;
  const showUploadFlowProgress = isUploading || showKickoff;

  const uploadFlowSteps: Array<{ label: string; description: string }> = [
    {
      label: "Prepare Requirement",
      description: "Checking purchase-order requirement and upload slot.",
    },
    {
      label: "Upload File",
      description: "Transferring the purchase order file to secure storage.",
    },
    {
      label: "Start Workflow",
      description: "Submitting evidence and triggering sales workflow kickoff.",
    },
    {
      label: "Sync Order",
      description:
        "Waiting for the new purchase order record to appear in live tracking.",
    },
    {
      label: "Ready",
      description: "Upload complete. Live workflow tracking is now active.",
    },
  ];

  const uploadFlowStageToIndex: Record<UploadFlowStage, number> = {
    idle: 0,
    ensuring_requirement: 0,
    uploading_file: 1,
    starting_workflow: 2,
    waiting_for_order: 3,
    complete: 4,
    error: 1,
  };

  const uploadCurrentIndex = uploadFlowStageToIndex[uploadFlowStage];
  const uploadProgressPercent = Math.max(
    8,
    (uploadCurrentIndex / (uploadFlowSteps.length - 1)) * 100,
  );
  const selectedUploadStep =
    uploadFlowSteps[
      Math.min(Math.max(selectedUploadStepIndex, 0), uploadFlowSteps.length - 1)
    ] ?? uploadFlowSteps[0];

  const formatElapsedMs = (milliseconds: number) => {
    const seconds = milliseconds / 1000;
    if (seconds < 10) {
      return `${seconds.toFixed(1)}s`;
    }

    return `${Math.round(seconds)}s`;
  };

  const getStepElapsedMs = (stepIndex: number) => {
    const completedDuration = uploadStageDurationsMs[stepIndex] ?? 0;
    if (
      stepIndex === uploadCurrentIndex &&
      uploadFlowCurrentStageStartedAtRef.current !== null
    ) {
      return (
        completedDuration +
        Math.max(
          0,
          uploadTimerTick - uploadFlowCurrentStageStartedAtRef.current,
        )
      );
    }

    return completedDuration;
  };

  useEffect(() => {
    const now = Date.now();
    const previousStage = uploadFlowPreviousStageRef.current;
    const previousStageIndex = uploadFlowStageToIndex[previousStage];

    if (uploadFlowStage === "idle") {
      uploadFlowPreviousStageRef.current = "idle";
      uploadFlowCurrentStageStartedAtRef.current = null;
      setUploadStageDurationsMs({});
      return;
    }

    if (uploadFlowCurrentStageStartedAtRef.current === null) {
      uploadFlowCurrentStageStartedAtRef.current = now;
      uploadFlowPreviousStageRef.current = uploadFlowStage;
      return;
    }

    if (previousStage !== uploadFlowStage) {
      const elapsed = Math.max(
        0,
        now - uploadFlowCurrentStageStartedAtRef.current,
      );

      setUploadStageDurationsMs((current) => ({
        ...current,
        [previousStageIndex]: (current[previousStageIndex] ?? 0) + elapsed,
      }));

      uploadFlowCurrentStageStartedAtRef.current = now;
      uploadFlowPreviousStageRef.current = uploadFlowStage;
    }
  }, [uploadFlowStage, uploadFlowStageToIndex]);

  useEffect(() => {
    if (!showUploadFlowProgress) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setUploadTimerTick(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showUploadFlowProgress]);

  useEffect(() => {
    if (!showKickoff || !uploadSuccess || !organizationId) {
      return;
    }

    const pollId = window.setInterval(() => {
      void queryClient.invalidateQueries({
        queryKey: ["customer-orders", organizationId],
      });
    }, 1500);

    return () => {
      window.clearInterval(pollId);
    };
  }, [organizationId, queryClient, showKickoff, uploadSuccess]);

  useEffect(() => {
    if (hasActiveOrder && uploadSuccess) {
      setUploadFlowStage("complete");
      setSelectedUploadStepIndex(4);
      setUploadSuccess(null);
    }
  }, [hasActiveOrder, uploadSuccess]);

  const OWNER_LABELS: Record<string, { owner: string; next: string }> = {
    "Purchase Order Received": {
      owner: "Sales",
      next: "Sales to validate your PO.",
    },
    "Order Validated": { owner: "Sales", next: "Sales reserving inventory." },
    "Inventory Reserved": {
      owner: "Sales",
      next: "Sales creating logistics handoff.",
    },
    "Logistics Handoff Created": {
      owner: "Sales",
      next: "Sales generating invoice.",
    },
    "Invoice Generated": { owner: "Sales", next: "Sales confirming shipment." },
    "Shipment Created": {
      owner: "Logistics",
      next: "Logistics acknowledging intake.",
    },
    "Order Received": {
      owner: "Logistics",
      next: "Logistics transmitting to warehouse.",
    },
    "Order Transmitted to Warehouse": {
      owner: "Logistics",
      next: "Logistics notifying you.",
    },
    "Notify Customer": {
      owner: "Logistics",
      next: "Logistics packing your items.",
    },
    "Pack Items for Shipment": {
      owner: "Logistics",
      next: "Logistics generating shipping label.",
    },
    "Generate Shipping Label & Documentation": {
      owner: "Logistics",
      next: "Logistics dispatching shipment.",
    },
    "Track Shipment In Transit": {
      owner: "Logistics",
      next: "Shipment in transit — awaiting arrival.",
    },
    "Reroute Delivery": {
      owner: "Logistics",
      next: "Delivery issue being resolved.",
    },
    "Order Arrives at Destination": {
      owner: "Logistics",
      next: "Awaiting your POD signature.",
    },
    "Customer Receives & Signs POD": {
      owner: "You + Logistics",
      next: "POD signed — logistics updating system.",
    },
    "BluBook System Updated": {
      owner: "Logistics",
      next: "Final delivery confirmation pending.",
    },
    Delivered: { owner: "Complete", next: "Order delivered." },
  };

  if (customerContext.isLoading) {
    return <DashboardLoadingSkeleton metricCount={4} listCount={3} />;
  }

  if (customerContext.isError || !customerContext.data) {
    return <DashboardLoadingSkeleton metricCount={4} listCount={3} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Customer Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Submit Purchase Orders and track execution from one place.
          </p>
        </div>
        <Badge>{pendingPurchaseOrders.length} PO Pending</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          title="Purchase Orders Active"
          description="Orders currently moving through workflow."
        >
          <p className="text-3xl font-semibold text-cyan-200">
            {ordersQuery.isLoading ? "-" : activeOrders.length}
          </p>
        </Card>
        <Card title="SLA Metrics" description="Active SLAs against total SLAs.">
          <p className="text-3xl font-semibold text-emerald-300">
            {providerReadinessQuery.isLoading
              ? "-"
              : `${providerReadinessQuery.data?.slas.active ?? 0}/${providerReadinessQuery.data?.slas.total ?? 0}`}
          </p>
        </Card>
        <Card
          title="Service Requests Active"
          description="Requests generated and actively tracked."
        >
          <p className="text-3xl font-semibold text-fuchsia-200">
            {providerReadinessQuery.isLoading
              ? "-"
              : (providerReadinessQuery.data?.generatedCustomerRequests ?? 0)}
          </p>
        </Card>
        <Card title="Total Orders" description="All purchase orders submitted.">
          <p className="text-3xl font-semibold text-white">
            {ordersQuery.isLoading ? "-" : (ordersQuery.data?.length ?? 0)}
          </p>
        </Card>
        <Card title="Completed Orders" description="Successfully delivered.">
          <p className="text-3xl font-semibold text-emerald-300">
            {ordersQuery.isLoading ? "-" : completedOrders.length}
          </p>
        </Card>
        <Card
          title="PO Pending Upload"
          description="Awaiting PO file submission."
        >
          <p className="text-3xl font-semibold text-amber-200">
            {requirementsQuery.isLoading ? "-" : pendingPurchaseOrders.length}
          </p>
        </Card>
      </div>

      {/* ── Unified Purchase Order Workflow Panel ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-panel">
        {/* Header — always visible */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-base font-semibold text-white">
              Purchase Order Workflow
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Upload a PO to start fulfilment. Progress updates live.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Realtime connection dot */}
            <div
              className="flex items-center gap-1.5"
              title={realtimeStatusLabel}
            >
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  lastRealtimeEventAt
                    ? realtimeStatusClassName.includes("emerald")
                      ? "bg-emerald-400 shadow-[0_0_5px_#34d399]"
                      : "bg-amber-400"
                    : "bg-slate-600"
                }`}
              />
              <span className="text-[11px] text-slate-400">
                {lastRealtimeEventAt
                  ? realtimeStatusClassName.includes("emerald")
                    ? "Live"
                    : "Stale"
                  : "Waiting"}
              </span>
            </div>
            {/* Secondary upload button when an order is already tracked */}
            {hasActiveOrder && !isUploading ? (
              <FileUploader
                buttonLabel="Upload New PO"
                disabled={isUploading}
                onFilesSelected={(files) =>
                  void onPurchaseOrderFileChangeWithEnsure(files)
                }
              />
            ) : null}
          </div>
        </div>

        {/* Body — state machine */}
        <div className="px-5 py-5">
          {/* ── LOADING ── */}
          {ordersQuery.isLoading || requirementsQuery.isLoading ? (
            <div className="animate-pulse space-y-3 py-2">
              <div className="h-3 w-1/3 rounded bg-white/10" />
              <div className="h-3 w-2/3 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
            </div>
          ) : uploadError ? (
            /* ── ERROR ── */
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-4">
              <p className="text-sm font-semibold text-red-300">
                Upload failed
              </p>
              <p className="mt-1 text-xs text-red-200/90">{uploadError}</p>
              <button
                type="button"
                className="mt-3 text-[11px] font-medium text-red-300 underline underline-offset-2"
                onClick={() => setUploadError(null)}
              >
                Dismiss and try again
              </button>
            </div>
          ) : showUploadFlowProgress ? (
            /* ── UNIFIED UPLOAD FLOW ── */
            <div className="space-y-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Uploading your purchase order
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    One continuous flow from upload to live workflow tracking.
                  </p>
                </div>
                <p className="text-xs font-medium text-cyan-200">
                  {Math.round(uploadProgressPercent)}% complete
                </p>
              </div>

              <div className="relative pt-6">
                <div className="h-2 rounded-full bg-white/10" />
                <div
                  className="absolute left-0 top-6 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${uploadProgressPercent}%` }}
                />

                <div className="pointer-events-none absolute left-0 right-0 top-3.5 flex justify-between px-0.5">
                  {uploadFlowSteps.map((step, index) => {
                    const isDone = index < uploadCurrentIndex;
                    const isActive = index === uploadCurrentIndex;
                    return (
                      <span
                        key={step.label}
                        className={`h-6 w-6 rounded-full border text-center text-[11px] leading-6 transition-colors ${
                          isDone
                            ? "border-emerald-300/70 bg-emerald-300/20 text-emerald-200"
                            : isActive
                              ? "border-cyan-300/80 bg-cyan-300/20 text-cyan-100"
                              : "border-slate-500/60 bg-slate-900 text-slate-400"
                        }`}
                      >
                        {isDone ? "✓" : index + 1}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-5">
                {uploadFlowSteps.map((step, index) => {
                  const isDone = index < uploadCurrentIndex;
                  const isActive = index === uploadCurrentIndex;
                  const elapsedMs = getStepElapsedMs(index);
                  return (
                    <button
                      key={step.label}
                      type="button"
                      onClick={() => setSelectedUploadStepIndex(index)}
                      className={`rounded-lg border px-2 py-2 text-left text-[11px] transition-colors ${
                        selectedUploadStepIndex === index
                          ? "border-cyan-300/70 bg-cyan-500/10 text-cyan-100"
                          : isDone
                            ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                            : isActive
                              ? "border-cyan-300/40 bg-cyan-500/5 text-cyan-100"
                              : "border-white/10 bg-white/[0.03] text-slate-300"
                      }`}
                    >
                      <span className="block font-semibold">{step.label}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {isDone
                          ? "Completed"
                          : isActive
                            ? "In progress"
                            : "Pending"}
                      </span>
                      {elapsedMs > 0 ? (
                        <span className="mt-1 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100">
                          {formatElapsedMs(elapsedMs)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-xs font-semibold text-white">
                  {selectedUploadStep.label}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {selectedUploadStep.description}
                </p>
                {uploadSuccess?.fileName ? (
                  <p className="mt-1 text-[11px] text-cyan-200/90">
                    File: {uploadSuccess.fileName}
                  </p>
                ) : null}
                {uploadSuccess?.poReference ? (
                  <p className="mt-1 text-[11px] text-emerald-200/90">
                    PO: {uploadSuccess.poReference}
                  </p>
                ) : null}
              </div>
            </div>
          ) : hasActiveOrder ? (
            /* ── TRACKING ── */
            <div className="space-y-4">
              {retractOrderMutation.isError ? (
                <p className="text-sm text-red-300">
                  {retractOrderMutation.error instanceof Error
                    ? retractOrderMutation.error.message
                    : "Could not retract order."}
                </p>
              ) : null}
              {(() => {
                const order = activeOrder!;
                const ownerInfo = OWNER_LABELS[order.status] ?? {
                  owner: "Processing",
                  next: "Workflow is advancing.",
                };
                return (
                  <div>
                    {/* Order header row */}
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {order.poReference ?? order.id}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Updated {new Date(order.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="danger"
                        className="h-7 px-2.5 text-[11px]"
                        disabled={
                          retractOrderMutation.isPending &&
                          retractingOrderId === order.id
                        }
                        onClick={() =>
                          onRetractOrderRequest(order.id, order.poReference)
                        }
                      >
                        {retractOrderMutation.isPending &&
                        retractingOrderId === order.id
                          ? "Retracting..."
                          : "Retract"}
                      </Button>
                    </div>

                    {/* Current owner pill */}
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                      <span className="text-xs font-medium text-cyan-100">
                        {ownerInfo.owner}
                      </span>
                      <span className="text-[11px] text-cyan-300/70">
                        — {ownerInfo.next}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <WorkflowProgress
                      completedStepKeys={stepEventsQuery.data ?? []}
                    />

                    {/* Step matrix */}
                    <div className="mt-4">
                      <WorkflowStepMatrix
                        completedStepKeys={stepEventsQuery.data ?? []}
                        audience="customer"
                        title="Order Progress"
                      />
                    </div>

                    {(ordersQuery.data ?? []).length > 1 ? (
                      <p className="mt-3 text-[11px] text-slate-500">
                        Showing most recent.{" "}
                        <a
                          href="/customer/orders"
                          className="text-cyan-300 underline underline-offset-2"
                        >
                          View all {(ordersQuery.data ?? []).length} orders
                        </a>
                      </p>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ── IDLE — no orders yet ── */
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <svg
                  className="h-6 w-6 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">
                  No active purchase orders
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Upload a PO file to kick off your order workflow
                </p>
              </div>
              <FileUploader
                buttonLabel={
                  ensurePoRequirementMutation.isPending
                    ? "Preparing upload..."
                    : pendingPurchaseOrders.length > 0
                      ? `Upload ${pendingPurchaseOrders[0]!.title}`
                      : "Upload Purchase Order"
                }
                disabled={
                  ensurePoRequirementMutation.isPending ||
                  submitEvidenceMutation.isPending
                }
                onFilesSelected={(files) =>
                  pendingPurchaseOrders.length > 0
                    ? void onPurchaseOrderFileChange(
                        pendingPurchaseOrders[0]!.id,
                        files,
                      )
                    : void onPurchaseOrderFileChangeWithEnsure(files)
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/customer/requests" className="inline-flex">
          <Button variant="ghost">Open Requests</Button>
        </Link>
        <Link href="/customer/documents" className="inline-flex">
          <Button variant="ghost">Open Documents</Button>
        </Link>
      </div>

      <ConfirmDialog
        open={Boolean(retractConfirmOrder)}
        ariaLabel="Retract purchase order"
        title={`Retract ${retractConfirmOrder?.poReference ?? retractConfirmOrder?.id ?? "order"}?`}
        description="This removes the order and related workflow records."
        warning="Intended for testing and workflow reset scenarios."
        confirmLabel="Confirm Retract"
        busy={retractOrderMutation.isPending}
        onClose={() => setRetractConfirmOrder(null)}
        onConfirm={() => {
          void onRetractOrderConfirmed();
        }}
      />
    </div>
  );
}

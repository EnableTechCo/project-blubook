"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HoverAnimatedIcon } from "@/components/ui/hover-animated-icon";
import { Button } from "@/components/ui/button";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { EmptyStateNoticeCard } from "@/components/ui/empty-state-notice-card";
import { FileUploader } from "@/components/ui/file-uploader";
import { InlineErrorMessage } from "@/components/ui/inline-error-message";
import { MetricsCardGrid } from "@/components/ui/metrics-card-grid";
import { QuickLinksActionBar } from "@/components/ui/quick-links-action-bar";
import { RealtimeStatusDot } from "@/components/ui/realtime-status-dot";
import { WorkflowProgressPanel } from "@/components/ui/workflow-progress-panel";
import { WorkflowStepMatrix } from "@/components/ui/workflow-progress";
import { buildAudienceStepView } from "@/lib/workflow/workflow-step-contract";
import { getOwnerForStatus } from "@/lib/workflow/status-to-owner-map";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { useCustomerDashboardData } from "@/hooks/dashboard/use-customer-dashboard-data";
import { usePurchaseOrderUploadFlow } from "@/hooks/dashboard/use-purchase-order-upload-flow";
import { ActiveOrderTrackingCard } from "@/components/dashboard/customer/active-order-tracking-card";
import { CurrentOwnerPill } from "@/components/dashboard/customer/current-owner-pill";
import { CustomerWorkflowPanelContainer } from "@/components/dashboard/customer/customer-workflow-panel-container";
import { NoActiveOrderCtaPanel } from "@/components/dashboard/customer/no-active-order-cta-panel";
import { RetractOrderDialog } from "@/components/dashboard/customer/retract-order-dialog";
import { UploadFlowProgressRail } from "@/components/dashboard/customer/upload-flow-progress-rail";
import { UploadFlowStepCards } from "@/components/dashboard/customer/upload-flow-step-cards";
import { UploadFlowStepDetailsCard } from "@/components/dashboard/customer/upload-flow-step-details-card";
import { useRealtimeEventStatus } from "@/hooks/use-realtime-event-status";
import { useCustomerContext } from "@/hooks/use-customer-context";
import { listCustomerRequirements } from "@/services/requirements.service";
import requirementsService from "@/services/requirements.service";
import { subscribeToCustomerOrderProgress } from "@/services/workflow-realtime.service";
import { ChartBarIncreasingIcon } from "@/components/icons/chart-bar-increasing";
import { ClipboardCheckIcon } from "@/components/icons/clipboard-check";
import { FilePenLineIcon } from "@/components/icons/file-pen-line";
import { MessageSquareMoreIcon } from "@/components/icons/message-square-more";
import { ReceiptTextIcon } from "@/components/icons/receipt-text";
import { UploadIcon } from "@/components/icons/upload";
import { WorkflowIcon } from "@/components/icons/workflow";
import { XIcon } from "@/components/icons/x";

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

const UPLOAD_FLOW_STAGE_TO_INDEX: Record<UploadFlowStage, number> = {
  idle: 0,
  ensuring_requirement: 0,
  uploading_file: 1,
  starting_workflow: 2,
  waiting_for_order: 3,
  complete: 4,
  error: 1,
};

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
  const [isPurchaseOrderWorkflowVisible, setIsPurchaseOrderWorkflowVisible] =
    useState(false);
  const [isCloseButtonHovered, setIsCloseButtonHovered] = useState(false);
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

  const {
    activeOrders,
    completedOrders,
    pendingPurchaseOrders,
    displayedOrderId,
  } = useCustomerDashboardData({
    orders: ordersQuery.data ?? [],
    requirements: requirementsQuery.data ?? [],
  });

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
  const isInitialDashboardLoading =
    customerContext.isLoading ||
    (ordersQuery.isLoading && !ordersQuery.data) ||
    (requirementsQuery.isLoading && !requirementsQuery.data) ||
    (providerReadinessQuery.isLoading && !providerReadinessQuery.data);
  const isDashboardRefreshing =
    ordersQuery.isFetching ||
    requirementsQuery.isFetching ||
    providerReadinessQuery.isFetching;
  const activeOrder = activeOrders[0] ?? null;
  // Show kickoff animation when upload just completed but the order hasn't
  // appeared yet (orders query still re-fetching after invalidation).
  const showKickoff = uploadSuccess !== null && !hasActiveOrder;
  const showUploadFlowProgress = isUploading || showKickoff;

  const openPurchaseOrderWorkflowPanel = () => {
    setIsPurchaseOrderWorkflowVisible(true);
  };

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

  const { currentIndex: uploadCurrentIndex } =
    usePurchaseOrderUploadFlow(uploadFlowStage);
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
    const previousStageIndex = UPLOAD_FLOW_STAGE_TO_INDEX[previousStage];

    if (uploadFlowStage === "idle") {
      uploadFlowPreviousStageRef.current = "idle";
      uploadFlowCurrentStageStartedAtRef.current = null;
      setUploadStageDurationsMs((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
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
  }, [uploadFlowStage]);

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

  if (isInitialDashboardLoading) {
    return <DashboardLoadingSkeleton metricCount={4} listCount={3} />;
  }

  if (customerContext.isError || !customerContext.data) {
    return (
      <div className="space-y-4">
        <DashboardPageHeader
          title="Customer Dashboard"
          subtitle="Submit Purchase Orders and track execution from one place."
        />
        <EmptyStateNoticeCard
          title="Dashboard unavailable"
          description="Could not load your customer workspace right now. Please refresh and try again."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Customer Dashboard"
        subtitle="Submit Purchase Orders and track execution from one place."
        badge={
          isPurchaseOrderWorkflowVisible ? (
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.99]"
              onMouseEnter={() => setIsCloseButtonHovered(true)}
              onMouseLeave={() => setIsCloseButtonHovered(false)}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsPurchaseOrderWorkflowVisible(false);
              }}
            >
              <HoverAnimatedIcon
                icon={XIcon}
                active={isCloseButtonHovered}
                className="h-4 w-4"
                size={16}
              />
              Close
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-xl bg-coral px-3 text-xs font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                ensurePoRequirementMutation.isPending ||
                submitEvidenceMutation.isPending
              }
              onClick={openPurchaseOrderWorkflowPanel}
            >
              <HoverAnimatedIcon
                icon={hasActiveOrder ? WorkflowIcon : UploadIcon}
                active={false}
                className="h-4 w-4 mr-1.5"
                size={16}
              />
              {ensurePoRequirementMutation.isPending
                ? "Preparing upload..."
                : hasActiveOrder
                  ? "View Workflow Steps"
                  : "Upload Purchase Order"}
            </button>
          )
        }
      />

      {isPurchaseOrderWorkflowVisible ? (
        <CustomerWorkflowPanelContainer>
          {/* Header — always visible */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-5 py-4 dark:border-white/10">
            <div>
              <p className="text-base font-semibold text-slate-900">
                Purchase Order Workflow
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Upload a PO to start fulfilment. Progress updates live.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isDashboardRefreshing && !isUploading ? (
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-700">
                  Syncing updates...
                </span>
              ) : null}
              {/* Realtime connection dot */}
              <RealtimeStatusDot
                label={realtimeStatusLabel}
                isLive={Boolean(
                  lastRealtimeEventAt &&
                  realtimeStatusClassName.includes("emerald"),
                )}
                isStale={Boolean(
                  lastRealtimeEventAt &&
                  !realtimeStatusClassName.includes("emerald"),
                )}
              />
              {/* Secondary upload button when an order is already tracked */}
              {hasActiveOrder && !isUploading ? (
                <FileUploader
                  buttonLabel="Upload New PO"
                  icon={UploadIcon}
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
            {uploadError ? (
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
                    <p className="text-sm font-semibold text-slate-900">
                      Uploading your purchase order
                    </p>
                  </div>
                  <p className="text-xs font-medium text-cyan-700">
                    {Math.round(uploadProgressPercent)}% complete
                  </p>
                </div>

                <div className="relative">
                  <UploadFlowProgressRail percent={uploadProgressPercent} />
                  <div className="pointer-events-none absolute left-0 right-0 top-3.5 flex justify-between px-0.5">
                    {uploadFlowSteps.map((step, index) => {
                      const isDone = index < uploadCurrentIndex;
                      const isActive = index === uploadCurrentIndex;
                      return (
                        <span
                          key={step.label}
                          className={`h-6 w-6 rounded-full border text-center text-[11px] leading-6 transition-colors ${
                            isDone
                              ? "border-emerald-300/70 bg-emerald-300/20 text-emerald-800"
                              : isActive
                                ? "border-cyan-300/80 bg-cyan-300/20 text-cyan-800"
                                : "border-slate-500/60 bg-slate-900 text-slate-400"
                          }`}
                        >
                          {isDone ? "✓" : index + 1}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <UploadFlowStepCards>
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
                            ? "border-cyan-300/70 bg-cyan-500/10 text-cyan-800"
                            : isDone
                              ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-800"
                              : isActive
                                ? "border-cyan-300/40 bg-cyan-500/5 text-cyan-800"
                                : "border-slate-300 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                        }`}
                      >
                        <span className="block font-semibold">
                          {step.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-slate-400">
                          {isDone
                            ? "Completed"
                            : isActive
                              ? "In progress"
                              : "Pending"}
                        </span>
                        {elapsedMs > 0 ? (
                          <span className="mt-1 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-800">
                            {formatElapsedMs(elapsedMs)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </UploadFlowStepCards>

                <UploadFlowStepDetailsCard>
                  <p className="text-xs font-semibold text-slate-900">
                    {selectedUploadStep.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedUploadStep.description}
                  </p>
                  {uploadSuccess?.fileName ? (
                    <p className="mt-1 text-[11px] text-cyan-700">
                      File: {uploadSuccess.fileName}
                    </p>
                  ) : null}
                  {uploadSuccess?.poReference ? (
                    <p className="mt-1 text-[11px] text-emerald-700">
                      PO: {uploadSuccess.poReference}
                    </p>
                  ) : null}
                </UploadFlowStepDetailsCard>
              </div>
            ) : hasActiveOrder ? (
              /* ── TRACKING ── */
              <ActiveOrderTrackingCard>
                {retractOrderMutation.isError ? (
                  <InlineErrorMessage
                    className="text-sm"
                    message={
                      retractOrderMutation.error instanceof Error
                        ? retractOrderMutation.error.message
                        : "Could not retract order."
                    }
                  />
                ) : null}
                {(() => {
                  const order = activeOrder as CustomerOrderSummary;
                  const ownerInfo = getOwnerForStatus(order.status);
                  return (
                    <div>
                      {/* Order header row */}
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {order.poReference ?? order.id}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            Updated{" "}
                            {new Date(
                              order.updatedAt ?? Date.now(),
                            ).toLocaleString()}
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
                            onRetractOrderRequest(
                              order.id,
                              order.poReference ?? null,
                            )
                          }
                        >
                          {retractOrderMutation.isPending &&
                          retractingOrderId === order.id
                            ? "Retracting..."
                            : "Retract"}
                        </Button>
                      </div>

                      {/* Current owner pill */}
                      <CurrentOwnerPill
                        owner={ownerInfo.owner}
                        next={ownerInfo.next}
                      />

                      {/* Progress bar */}
                      <WorkflowProgressPanel
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
              </ActiveOrderTrackingCard>
            ) : (
              /* ── IDLE — no orders yet ── */
              <NoActiveOrderCtaPanel
                title="No active purchase orders"
                description="Upload a PO file to kick off your order workflow"
                icon={
                  <div className="flex h-14 w-14 items-center justify-center border border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                    <FilePenLineIcon
                      className="h-6 w-6 text-slate-400"
                      size={24}
                    />
                  </div>
                }
                action={
                  <FileUploader
                    buttonLabel={
                      ensurePoRequirementMutation.isPending
                        ? "Preparing upload..."
                        : pendingPurchaseOrders.length > 0
                          ? `Upload ${pendingPurchaseOrders[0]!.title}`
                          : "Upload Purchase Order"
                    }
                    icon={UploadIcon}
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
                }
              />
            )}
          </div>
        </CustomerWorkflowPanelContainer>
      ) : null}

      <MetricsCardGrid
        items={[
          {
            key: "po-active",
            title: "Purchase Orders Active",
            description: "Orders currently moving through workflow.",
            value: activeOrders.length,
            icon: WorkflowIcon,
            valueClassName: "text-cyan-700",
            titleClampLines: 2,
            descriptionClampLines: 2,
          },
          {
            key: "sla-metrics",
            title: "SLA Metrics",
            description: "Active SLAs against total SLAs.",
            value: `${providerReadinessQuery.data?.slas.active ?? 0}/${providerReadinessQuery.data?.slas.total ?? 0}`,
            icon: ChartBarIncreasingIcon,
            valueClassName: "text-emerald-300",
            titleClampLines: 2,
            descriptionClampLines: 2,
          },
          {
            key: "service-requests-active",
            title: "Service Requests Active",
            description: "Requests generated and actively tracked.",
            value: providerReadinessQuery.data?.generatedCustomerRequests ?? 0,
            icon: MessageSquareMoreIcon,
            valueClassName: "text-cyan-700",
            titleClampLines: 2,
            descriptionClampLines: 2,
          },
          {
            key: "total-orders",
            title: "Total Orders",
            description: "All purchase orders submitted.",
            value: ordersQuery.data?.length ?? 0,
            icon: ReceiptTextIcon,
            valueClassName: "text-slate-900",
            titleClampLines: 2,
            descriptionClampLines: 2,
          },
          {
            key: "completed-orders",
            title: "Completed Orders",
            description: "Successfully delivered.",
            value: completedOrders.length,
            icon: ClipboardCheckIcon,
            valueClassName: "text-emerald-300",
            titleClampLines: 2,
            descriptionClampLines: 2,
          },
          {
            key: "po-pending-upload",
            title: "PO Pending Upload",
            description: "Awaiting PO file submission.",
            value: pendingPurchaseOrders.length,
            icon: UploadIcon,
            valueClassName: "text-cyan-700",
            titleClampLines: 2,
            descriptionClampLines: 2,
          },
        ]}
      />

      <QuickLinksActionBar
        links={[
          { href: "/customer/requests", label: "Open Requests" },
          { href: "/customer/documents", label: "Open Documents" },
        ]}
      />

      <RetractOrderDialog
        open={Boolean(retractConfirmOrder)}
        title={`Retract ${retractConfirmOrder?.poReference ?? retractConfirmOrder?.id ?? "order"}?`}
        busy={retractOrderMutation.isPending}
        onClose={() => setRetractConfirmOrder(null)}
        onConfirm={() => void onRetractOrderConfirmed()}
      />
    </div>
  );
}

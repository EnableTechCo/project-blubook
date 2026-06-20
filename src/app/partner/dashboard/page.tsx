"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoxesIcon } from "@/components/icons/boxes";
import { ClipboardCheckIcon } from "@/components/icons/clipboard-check";
import { FileCheckIcon } from "@/components/icons/file-check";
import { HistoryIcon } from "@/components/icons/history";
import { ReceiptTextIcon } from "@/components/icons/receipt-text";
import { XIcon } from "@/components/icons/x";
import { subscribeToPartnerWorkOrders } from "@/services/workflow-realtime.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdditionalItemsPillList } from "@/components/ui/additional-items-pill-list";
import { ActionButtonWithLoading } from "@/components/ui/action-button-with-loading";
import { DualDocumentUploadModal } from "@/components/ui/dual-document-upload-modal";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { EmptyStateNoticeCard } from "@/components/ui/empty-state-notice-card";
import { EntityHeaderRow } from "@/components/ui/entity-header-row";
import { InlineErrorMessage } from "@/components/ui/inline-error-message";
import { MetricsCardGrid } from "@/components/ui/metrics-card-grid";
import { SequencedActionHint } from "@/components/ui/sequenced-action-hint";
import { StepStateChipsRow } from "@/components/ui/step-state-chips-row";
import { WorkflowOpsSectionShell } from "@/components/ui/workflow-ops-section-shell";
import { WorkflowProgressPanel } from "@/components/ui/workflow-progress-panel";
import { uploadDocument } from "@/services/documents.service";
import { LogisticsWorkOrdersCtaCard } from "@/components/dashboard/partner/logistics-work-orders-cta-card";
import { PartnerRequestPingCard } from "@/components/dashboard/partner/partner-request-ping-card";
import { PartnerRequestQueueItem } from "@/components/dashboard/partner/partner-request-queue-item";
import { ActivityTimeline } from "@/components/dashboard/partner/activity-timeline";
import {
  WorkflowStepMatrix,
  getWorkflowStageIndexFromSalesOrder,
  normalizeWorkflowCompletedStepKeys,
} from "@/components/ui/workflow-progress";
import { WORKFLOW_ACTION_LABELS } from "@/constants/workflow-stage-labels";
import { getStreamDisplayName } from "@/constants/stream-display";
import {
  buildWorkflowStepSnapshot,
  getLogisticsWorkOrderHeading,
  getPurchaseOrderProgressLabel,
  hasTimelineStep,
} from "@/lib/workflow/workflow-snapshot-builder";
import { logPartnerDashboardDiagnostics } from "@/lib/workflow/partner-dashboard-console-diagnostics";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { usePartnerDashboardActions } from "@/hooks/dashboard/use-partner-dashboard-actions";
import { usePartnerDashboardData } from "@/hooks/dashboard/use-partner-dashboard-data";
import { WorkflowStepActions } from "@/components/ui/workflow-step-actions";
import { WorkflowStepInputModal } from "@/components/ui/workflow-step-input-modal";
import { getWorkflowStep } from "@/lib/workflow/workflow-step-contract";

type PartnerRequestStatus = "sent" | "acknowledged" | "failed";

type PartnerDashboardRequest = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  packageId: string | null;
  packageTierCode: string | null;
  packageTierName: string | null;
  packageStream: string;
  requestStatus: PartnerRequestStatus;
  sentAt: string;
  acknowledgedAt: string | null;
  providerName: string | null;
  requiredDocsTotal: number;
  requiredDocsPending: number;
  aiReadiness: {
    status: "high" | "medium" | "low" | "insufficient_signal";
    label: string;
    score: number | null;
    confidence: number | null;
    reasons: string[];
    modelVersion: string | null;
    docsCompleteness: number;
  };
};

type PartnerDashboardPayload = {
  partner: {
    id: string;
    name: string | null;
    offeredServiceStream: string | null;
    isLogistics?: boolean;
  };
  requests: PartnerDashboardRequest[];
  summary: {
    total: number;
    sent: number;
    acknowledged: number;
    failed: number;
    pendingCustomerDocs: number;
    readyForExecution: number;
  };
  purchaseOrders?: {
    total: number;
    active: number;
    pendingAction: number;
    recent: Array<{
      id: string;
      source?: "handoff" | "direct";
      status: string;
      assignedAt: string;
      salesOrderId: string;
      poReference: string;
      organizationName: string | null;
      orderStatus: string | null;
      orderTimeline: Array<{ step?: string }>;
      purchaseOrderRequirement?: {
        requirementItemId: string;
        title: string;
        status: string;
        statusReason: string | null;
        updatedAt: string;
        evidence: Array<{
          id: string;
          fileName: string;
          uploadedAt: string;
          signedUrl: string | null;
        }>;
      } | null;
    }>;
    additionalRecent?: Array<{
      id: string;
      source?: "handoff" | "direct";
      status: string;
      assignedAt: string;
      salesOrderId: string;
      poReference: string;
      organizationName: string | null;
      orderStatus: string | null;
      orderTimeline: Array<{ step?: string }>;
      purchaseOrderRequirement?: {
        requirementItemId: string;
        title: string;
        status: string;
        statusReason: string | null;
        updatedAt: string;
        evidence: Array<{
          id: string;
          fileName: string;
          uploadedAt: string;
          signedUrl: string | null;
        }>;
      } | null;
    }>;
  };
  logisticsWorkOrders?: {
    total: number;
    pendingAcceptance: number;
    accepted: number;
    inProgress: number;
    completed: number;
    rejected: number;
    recent: Array<{
      id: string;
      status: string;
      assignedAt: string;
      salesOrderId: string;
      poReference: string;
      organizationName: string | null;
      orderStatus: string | null;
      orderTimeline: Array<{ step?: string }>;
      purchaseOrderRequirement?: {
        requirementItemId: string;
        title: string;
        status: string;
        statusReason: string | null;
        updatedAt: string;
        evidence: Array<{
          id: string;
          fileName: string;
          uploadedAt: string;
          signedUrl: string | null;
        }>;
      } | null;
    }>;
    additionalRecent?: Array<{
      id: string;
      status: string;
      assignedAt: string;
      salesOrderId: string;
      poReference: string;
      organizationName: string | null;
      orderStatus: string | null;
      orderTimeline: Array<{ step?: string }>;
      purchaseOrderRequirement?: {
        requirementItemId: string;
        title: string;
        status: string;
        statusReason: string | null;
        updatedAt: string;
        evidence: Array<{
          id: string;
          fileName: string;
          uploadedAt: string;
          signedUrl: string | null;
        }>;
      } | null;
    }>;
    all?: Array<{
      id: string;
      status: string;
      assignedAt: string;
      salesOrderId: string;
      poReference: string;
      organizationName: string | null;
      orderStatus: string | null;
      orderTimeline: Array<{ step?: string }>;
      purchaseOrderRequirement?: {
        requirementItemId: string;
        title: string;
        status: string;
        statusReason: string | null;
        updatedAt: string;
        evidence: Array<{
          id: string;
          fileName: string;
          uploadedAt: string;
          signedUrl: string | null;
        }>;
      } | null;
    }>;
  };
};

function formatStepKeyLabel(stepKey: string) {
  return stepKey
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

type LogisticsCheckpoint = {
  key: string;
  label: string;
  completed: boolean;
};

type LogisticsWorkflowAction =
  | "accept"
  | "start"
  | "notify_customer"
  | "pack_items"
  | "in_transit"
  | "arrived"
  | "pod_signed"
  | "system_updated"
  | "complete"
  | "reject"
  | "rollback_start";

type PendingReturnToSalesAction = {
  handoffId: string;
  title: string;
};

function getLogisticsCheckpoints(input: {
  status: string;
  completedStepKeys: string[];
}): LogisticsCheckpoint[] {
  const normalizedStatus = input.status.trim().toLowerCase();
  const hasCompletedStep = (step: string) =>
    input.completedStepKeys.includes(step);

  return [
    {
      key: "handoff_accepted",
      label: "Handoff accepted from sales",
      completed:
        normalizedStatus === "accepted" ||
        normalizedStatus === "in_progress" ||
        normalizedStatus === "completed" ||
        hasCompletedStep("logistics_handoff_accepted"),
    },
    {
      key: "on_way_warehouse",
      label: "On the way to warehouse",
      completed:
        hasCompletedStep("order_transmitted_to_warehouse") ||
        hasCompletedStep("logistics_fulfillment_started"),
    },
    {
      key: "arrived_warehouse",
      label: "Arrived at warehouse",
      completed: hasCompletedStep("order_received"),
    },
    {
      key: "package_picked",
      label: "Package picked up",
      completed: hasCompletedStep("pack_items_for_shipment"),
    },
    {
      key: "in_transit",
      label: "Shipment in transit",
      completed:
        hasCompletedStep("track_shipment_in_transit") ||
        hasCompletedStep("shipment_in_transit"),
    },
    {
      key: "arrived_destination",
      label: "Arrived at destination",
      completed: hasCompletedStep("order_arrives_at_destination"),
    },
    {
      key: "pod_signed",
      label: "Proof of delivery signed",
      completed: hasCompletedStep("customer_receives_signs_pod"),
    },
  ];
}

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<PartnerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );
  const [confirmingPoId, setConfirmingPoId] = useState<string | null>(null);
  const [processingSalesAdvanceKey, setProcessingSalesAdvanceKey] = useState<
    string | null
  >(null);
  const [pendingSalesStepAction, setPendingSalesStepAction] = useState<{
    salesOrderId: string;
    action:
      | "validate"
      | "reserve_inventory"
      | "create_handoff"
      | "rollback_inventory"
      | "rollback_validation";
    label: string;
    stepKey: string;
  } | null>(null);
  const [pendingLogisticsStepAction, setPendingLogisticsStepAction] = useState<{
    handoffId: string;
    salesOrderId: string;
    action:
      | "accept"
      | "start"
      | "notify_customer"
      | "pack_items"
      | "in_transit"
      | "arrived"
      | "pod_signed"
      | "system_updated";
    label: string;
    stepKey: string;
  } | null>(null);
  const [pendingReturnToSalesAction, setPendingReturnToSalesAction] =
    useState<PendingReturnToSalesAction | null>(null);
  const [returnToSalesReason, setReturnToSalesReason] = useState("");
  const [returnToSalesError, setReturnToSalesError] = useState<string | null>(
    null,
  );
  const [poConfirmError, setPoConfirmError] = useState<string | null>(null);
  const [poReviewError, setPoReviewError] = useState<string | null>(null);
  const [poReviewReasonByRequirement, setPoReviewReasonByRequirement] =
    useState<Record<string, string>>({});
  const [processingPoReviewRequirementId, setProcessingPoReviewRequirementId] =
    useState<string | null>(null);
  const [processingHandoffActionKey, setProcessingHandoffActionKey] = useState<
    string | null
  >(null);
  const [handoffConfirmError, setHandoffConfirmError] = useState<string | null>(
    null,
  );
  const [activeUploadHandoff, setActiveUploadHandoff] = useState<{
    id: string;
    poReference: string;
  } | null>(null);
  const [shippingLabelFile, setShippingLabelFile] = useState<File | null>(null);
  const [proofOfDeliveryFile, setProofOfDeliveryFile] = useState<File | null>(
    null,
  );
  const [uploadModalError, setUploadModalError] = useState<string | null>(null);
  const [isUploadCompleting, setIsUploadCompleting] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    try {
      setError(null);

      const response = await fetch("/api/partner/dashboard", { method: "GET" });
      const body = (await response.json().catch(() => null)) as
        | PartnerDashboardPayload
        | { error?: string }
        | null;

      if (
        !response.ok ||
        !body ||
        !("summary" in body) ||
        !("requests" in body) ||
        !("partner" in body)
      ) {
        setError(
          (body && "error" in body && typeof body.error === "string"
            ? body.error
            : null) ?? "Could not load partner dashboard.",
        );
        setPayload(null);
        return;
      }

      console.group("[PartnerDashboard] Partner Request Intake");
      console.log("loggedInPartner", {
        partnerId: body.partner.id,
        partnerName: body.partner.name,
        offeredServiceStream: body.partner.offeredServiceStream,
        isLogistics: body.partner.isLogistics ?? false,
      });
      console.log("summary", body.summary);
      console.log("purchaseOrders", {
        total: body.purchaseOrders?.total ?? 0,
        active: body.purchaseOrders?.active ?? 0,
        pendingAction: body.purchaseOrders?.pendingAction ?? 0,
        recent: (body.purchaseOrders?.recent ?? []).map((item) => ({
          id: item.id,
          poReference: item.poReference,
          status: item.status,
          orderStatus: item.orderStatus,
          salesOrderId: item.salesOrderId,
        })),
      });
      console.log("logisticsWorkOrders", {
        total: body.logisticsWorkOrders?.total ?? 0,
        pendingAcceptance: body.logisticsWorkOrders?.pendingAcceptance ?? 0,
        accepted: body.logisticsWorkOrders?.accepted ?? 0,
        inProgress: body.logisticsWorkOrders?.inProgress ?? 0,
        completed: body.logisticsWorkOrders?.completed ?? 0,
        rejected: body.logisticsWorkOrders?.rejected ?? 0,
        allCount: body.logisticsWorkOrders?.all?.length ?? 0,
        recent: (body.logisticsWorkOrders?.recent ?? []).map((item) => ({
          id: item.id,
          poReference: item.poReference,
          status: item.status,
          orderStatus: item.orderStatus,
          salesOrderId: item.salesOrderId,
        })),
        all: (body.logisticsWorkOrders?.all ?? []).map((item) => ({
          id: item.id,
          poReference: item.poReference,
          status: item.status,
          orderStatus: item.orderStatus,
          salesOrderId: item.salesOrderId,
        })),
      });
      if (body.partner.isLogistics) {
        console.info("[PartnerDashboard] Logistics partner logged in", {
          partnerId: body.partner.id,
          partnerName: body.partner.name,
          offeredServiceStream: body.partner.offeredServiceStream,
          hasAssignedWorkOrders: (body.logisticsWorkOrders?.total ?? 0) > 0,
          assignedWorkOrderCount: body.logisticsWorkOrders?.total ?? 0,
          logisticsWorkOrders: {
            total: body.logisticsWorkOrders?.total ?? 0,
            pendingAcceptance: body.logisticsWorkOrders?.pendingAcceptance ?? 0,
            accepted: body.logisticsWorkOrders?.accepted ?? 0,
            inProgress: body.logisticsWorkOrders?.inProgress ?? 0,
            completed: body.logisticsWorkOrders?.completed ?? 0,
            rejected: body.logisticsWorkOrders?.rejected ?? 0,
            recentCount: body.logisticsWorkOrders?.recent?.length ?? 0,
            allCount: body.logisticsWorkOrders?.all?.length ?? 0,
            recent: (body.logisticsWorkOrders?.recent ?? []).map((item) => ({
              id: item.id,
              poReference: item.poReference,
              handoffStatus: item.status,
              workflowState: item.orderStatus,
              salesOrderId: item.salesOrderId,
            })),
            all: (body.logisticsWorkOrders?.all ?? []).map((item) => ({
              id: item.id,
              poReference: item.poReference,
              handoffStatus: item.status,
              workflowState: item.orderStatus,
              salesOrderId: item.salesOrderId,
            })),
          },
        });
      } else {
        console.info(
          "[PartnerDashboard] Partner session is not classified as logistics",
          {
            partnerId: body.partner.id,
            partnerName: body.partner.name,
            offeredServiceStream: body.partner.offeredServiceStream,
            isLogistics: body.partner.isLogistics ?? false,
          },
        );
      }

      const grouped = new Map<
        string,
        {
          organization: string;
          purchasedTier: string | null;
          packageStream: string;
          totalRequests: number;
          sent: number;
          acknowledged: number;
          failed: number;
          docsPendingTotal: number;
          docsRequiredTotal: number;
        }
      >();

      for (const request of body.requests) {
        const organization = request.organizationName || request.organizationId;
        const purchasedTier =
          request.packageTierName ||
          request.packageTierCode ||
          request.packageId;
        const key = `${organization}|${purchasedTier || "unknown"}|${request.packageStream}`;

        const current = grouped.get(key) ?? {
          organization,
          purchasedTier: purchasedTier ?? null,
          packageStream: request.packageStream,
          totalRequests: 0,
          sent: 0,
          acknowledged: 0,
          failed: 0,
          docsPendingTotal: 0,
          docsRequiredTotal: 0,
        };

        current.totalRequests += 1;
        if (request.requestStatus === "sent") current.sent += 1;
        if (request.requestStatus === "acknowledged") current.acknowledged += 1;
        if (request.requestStatus === "failed") current.failed += 1;
        current.docsPendingTotal += request.requiredDocsPending;
        current.docsRequiredTotal += request.requiredDocsTotal;

        grouped.set(key, current);
      }

      console.table(Array.from(grouped.values()));

      if (body.requests.length <= 20) {
        console.groupCollapsed("requestDetails");
        for (const request of body.requests) {
          console.log("request", {
            id: request.id,
            organization: request.organizationName || request.organizationId,
            purchasedTier:
              request.packageTierName ||
              request.packageTierCode ||
              request.packageId,
            packageStream: request.packageStream,
            status: request.requestStatus,
            requiredDocsPending: request.requiredDocsPending,
            requiredDocsTotal: request.requiredDocsTotal,
          });
        }
        console.groupEnd();
      }

      console.groupEnd();

      setPayload(body);
    } catch {
      setError("Could not load partner dashboard.");
      setPayload(null);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();

    const unsubscribe = subscribeToPartnerWorkOrders(() => {
      void fetchDashboard();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchDashboard]);

  async function submitDecision(
    requestId: string,
    action: "accept" | "reject",
  ) {
    setProcessingRequestId(requestId);

    console.log("[PartnerDashboard] decision", { requestId, action });

    const response = await fetch("/api/partner/dashboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId, action }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Could not update request decision.");
      setProcessingRequestId(null);
      return;
    }

    setProcessingRequestId(null);
    void fetchDashboard();
  }

  async function confirmPurchaseOrder(input: {
    id: string;
    salesOrderId: string;
  }) {
    console.group("[PartnerDashboard] confirmPurchaseOrder:click");
    console.log("input", input);
    setConfirmingPoId(input.id);
    setPoConfirmError(null);

    const isDirectSalesOrder = input.id.startsWith("sales-order-");
    const payload = {
      handoffId: isDirectSalesOrder ? null : input.id,
      salesOrderId: input.salesOrderId,
    };

    console.log("requestPayload", payload);

    const response = await fetch("/api/partner/purchase-orders/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
      orderId?: string;
      poReference?: string;
      dispatch?: {
        processed: number;
        succeeded: number;
        failed: number;
      };
    } | null;

    console.log("response", {
      ok: response.ok,
      status: response.status,
      body,
    });

    if (!response.ok) {
      setPoConfirmError(body?.error ?? "Could not confirm purchase order.");
      setConfirmingPoId(null);
      console.warn("[PartnerDashboard] confirmPurchaseOrder:error", {
        poId: input.id,
        status: response.status,
        error: body?.error ?? "unknown",
      });
      console.groupEnd();
      return;
    }

    setConfirmingPoId(null);
    console.info("[PartnerDashboard] confirmPurchaseOrder:success", {
      poId: input.id,
      salesOrderId: input.salesOrderId,
      orderId: body?.orderId ?? null,
      poReference: body?.poReference ?? null,
      dispatch: body?.dispatch ?? null,
    });
    void fetchDashboard();
    console.groupEnd();
  }

  async function advanceSalesOrderFromCard(input: {
    salesOrderId: string;
    action:
      | "validate"
      | "reserve_inventory"
      | "create_handoff"
      | "rollback_inventory"
      | "rollback_validation";
    label: string;
    stepInputData?: Record<string, unknown>;
    actorNotes?: string;
  }) {
    const key = `${input.salesOrderId}:${input.action}`;
    setProcessingSalesAdvanceKey(key);
    setPoConfirmError(null);

    const stepKeyByAction: Record<string, string> = {
      validate: "order_validated",
      reserve_inventory: "inventory_reserved",
      create_handoff: "logistics_handoff_created",
    };
    const stepKey = stepKeyByAction[input.action] ?? "";

    if (stepKey && input.stepInputData) {
      const stepInputResponse = await fetch(
        `/api/orders/${input.salesOrderId}/step-inputs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            stepKey,
            inputData: input.stepInputData,
            actorNotes: input.actorNotes ?? "",
          }),
        },
      );

      if (!stepInputResponse.ok) {
        const stepInputBody = (await stepInputResponse
          .json()
          .catch(() => null)) as { error?: string } | null;
        setPoConfirmError(
          stepInputBody?.error ?? `Could not save inputs: ${input.label}`,
        );
        setProcessingSalesAdvanceKey(null);
        return stepInputBody?.error ?? `Could not save inputs: ${input.label}`;
      }
    }

    const response = await fetch("/api/sales/orders/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        orderId: input.salesOrderId,
        action: input.action,
        stepInputData: input.stepInputData ?? null,
        actorNotes: input.actorNotes ?? "",
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
      to?: string;
    } | null;

    if (!response.ok) {
      setPoConfirmError(body?.error ?? `Could not run: ${input.label}`);
      setProcessingSalesAdvanceKey(null);
      return body?.error ?? `Could not run: ${input.label}`;
    }

    console.info("[PartnerDashboard] salesAdvance:success", {
      salesOrderId: input.salesOrderId,
      action: input.action,
      toStatus: body?.to ?? null,
    });

    setProcessingSalesAdvanceKey(null);
    void fetchDashboard();
    return null;
  }

  function triggerSalesActionWithOptionalInputs(input: {
    salesOrderId: string;
    action:
      | "validate"
      | "reserve_inventory"
      | "create_handoff"
      | "rollback_inventory"
      | "rollback_validation";
    label: string;
  }) {
    const stepKeyByAction: Record<string, string> = {
      validate: "order_validated",
      reserve_inventory: "inventory_reserved",
      create_handoff: "logistics_handoff_created",
    };

    const stepKey = stepKeyByAction[input.action] ?? "";
    const stepContract = stepKey ? getWorkflowStep(stepKey) : null;
    const hasRequiredFields =
      stepContract?.inputFields.some((field) => field.required) ?? false;

    if (
      hasRequiredFields &&
      (input.action === "validate" ||
        input.action === "reserve_inventory" ||
        input.action === "create_handoff")
    ) {
      setPendingSalesStepAction({
        salesOrderId: input.salesOrderId,
        action: input.action,
        label: input.label,
        stepKey,
      });
      return;
    }

    void advanceSalesOrderFromCard(input);
  }

  async function submitPurchaseOrderReview(input: {
    requirementItemId: string;
    action: "approve" | "request_resubmission";
    reason?: string;
  }) {
    setPoReviewError(null);
    setProcessingPoReviewRequirementId(input.requirementItemId);

    const response = await fetch("/api/partner/requirements/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirementItemId: input.requirementItemId,
        action: input.action,
        reason: input.reason,
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setPoReviewError(body?.error ?? "Could not submit PO review decision.");
      setProcessingPoReviewRequirementId(null);
      return;
    }

    setProcessingPoReviewRequirementId(null);
    setPoReviewReasonByRequirement((current) => ({
      ...current,
      [input.requirementItemId]: "",
    }));
    void fetchDashboard();
  }

  async function updateLogisticsHandoffStatus(
    handoffId: string,
    action: LogisticsWorkflowAction,
    options?: {
      salesOrderId?: string;
      stepInputData?: Record<string, unknown>;
      actorNotes?: string;
      notes?: string;
    },
  ) {
    const actionKey = `${handoffId}:${action}`;
    setProcessingHandoffActionKey(actionKey);
    setHandoffConfirmError(null);

    const stepKeyByAction: Record<string, string> = {
      accept: "order_received",
      start: "order_transmitted_to_warehouse",
      notify_customer: "notify_customer",
      pack_items: "pack_items_for_shipment",
      in_transit: "track_shipment_in_transit",
      arrived: "order_arrives_at_destination",
      pod_signed: "customer_receives_signs_pod",
      system_updated: "blubook_system_updated",
    };
    const stepKey = stepKeyByAction[action] ?? "";

    if (stepKey && options?.salesOrderId && options.stepInputData) {
      const stepEventResponse = await fetch(
        `/api/orders/${options.salesOrderId}/step-events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            stepKey,
            source: `partner/work-orders:${action}`,
            inputData: options.stepInputData,
            actorNotes: options.actorNotes ?? "",
            metadata: { handoffId, action },
          }),
        },
      );

      if (!stepEventResponse.ok && stepEventResponse.status !== 409) {
        const stepEventBody = (await stepEventResponse
          .json()
          .catch(() => null)) as { error?: string } | null;
        setHandoffConfirmError(
          stepEventBody?.error ?? "Could not save logistics step inputs.",
        );
        setProcessingHandoffActionKey(null);
        return stepEventBody?.error ?? "Could not save logistics step inputs.";
      }
    }

    const response = await fetch("/api/partner/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerHandoffId: handoffId,
        action,
        notes: options?.notes ?? undefined,
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setHandoffConfirmError(body?.error ?? "Could not confirm handoff.");
      setProcessingHandoffActionKey(null);
      return body?.error ?? "Could not confirm handoff.";
    }

    setProcessingHandoffActionKey(null);
    void fetchDashboard();
    return null;
  }

  function triggerLogisticsActionWithOptionalInputs(input: {
    handoffId: string;
    salesOrderId: string;
    action:
      | "accept"
      | "start"
      | "notify_customer"
      | "pack_items"
      | "in_transit"
      | "arrived"
      | "pod_signed"
      | "system_updated";
    label: string;
  }) {
    const stepKeyByAction: Record<
      | "accept"
      | "start"
      | "notify_customer"
      | "pack_items"
      | "in_transit"
      | "arrived"
      | "pod_signed"
      | "system_updated",
      string
    > = {
      accept: "order_received",
      start: "order_transmitted_to_warehouse",
      notify_customer: "notify_customer",
      pack_items: "pack_items_for_shipment",
      in_transit: "track_shipment_in_transit",
      arrived: "order_arrives_at_destination",
      pod_signed: "customer_receives_signs_pod",
      system_updated: "blubook_system_updated",
    };

    const stepKey = stepKeyByAction[input.action];
    const stepContract = getWorkflowStep(stepKey);
    const hasRequiredFields =
      stepContract?.inputFields.some((field) => field.required) ?? false;

    if (hasRequiredFields) {
      setPendingLogisticsStepAction({
        handoffId: input.handoffId,
        salesOrderId: input.salesOrderId,
        action: input.action,
        label: input.label,
        stepKey,
      });
      return;
    }

    void updateLogisticsHandoffStatus(input.handoffId, input.action);
  }

  async function submitReturnToSalesWithReason() {
    if (!pendingReturnToSalesAction) {
      return;
    }

    const reason = returnToSalesReason.trim();
    if (!reason) {
      setReturnToSalesError(
        "Rejection reason is required before returning to sales.",
      );
      return;
    }

    setReturnToSalesError(null);

    const err = await updateLogisticsHandoffStatus(
      pendingReturnToSalesAction.handoffId,
      "reject",
      { notes: reason },
    );

    if (!err) {
      setPendingReturnToSalesAction(null);
      setReturnToSalesReason("");
      setReturnToSalesError(null);
    }
  }

  async function uploadDocsAndCompleteHandoff() {
    if (!activeUploadHandoff) {
      return;
    }

    if (!shippingLabelFile || !proofOfDeliveryFile) {
      setUploadModalError(
        "Upload both Shipping label and Proof of delivery before completing.",
      );
      return;
    }

    const partnerId = payload?.partner.id;
    if (!partnerId) {
      setUploadModalError("Could not resolve partner workspace for upload.");
      return;
    }

    setIsUploadCompleting(true);
    setUploadModalError(null);

    const bucket =
      process.env.NEXT_PUBLIC_PARTNER_DOCUMENTS_BUCKET?.trim() ||
      "partner-documents";
    const prefix = `partners/${partnerId}`;

    const uploadOne = async (
      file: File,
      documentType: "shipping-label" | "proof-of-delivery",
      documentTypeLabel: string,
    ) => {
      const cleanedName = file.name.replace(/\s+/g, "-").toLowerCase();
      const path = `${prefix}/${documentType}/${Date.now()}-${cleanedName}`;

      await uploadDocument({
        bucket,
        path,
        file,
        documentType,
        documentTypeLabel,
      });
    };

    try {
      await uploadOne(shippingLabelFile, "shipping-label", "Shipping label");
      await uploadOne(
        proofOfDeliveryFile,
        "proof-of-delivery",
        "Proof of delivery",
      );

      const response = await fetch("/api/partner/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerHandoffId: activeUploadHandoff.id,
          action: "complete",
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setUploadModalError(body?.error ?? "Could not complete work order.");
        return;
      }

      setActiveUploadHandoff(null);
      setShippingLabelFile(null);
      setProofOfDeliveryFile(null);
      void fetchDashboard();
    } catch (error) {
      setUploadModalError(
        error instanceof Error ? error.message : "Could not upload documents.",
      );
    } finally {
      setIsUploadCompleting(false);
    }
  }

  const {
    summary,
    newPings: rawNewPings,
    acceptedRequests: rawAcceptedRequests,
    isLogisticsPartner,
  } = usePartnerDashboardData(payload);
  const newPings = rawNewPings as PartnerDashboardRequest[];
  const acceptedRequests = rawAcceptedRequests as PartnerDashboardRequest[];
  const purchaseOrders = useMemo(
    () =>
      payload?.purchaseOrders ?? {
        total: 0,
        active: 0,
        pendingAction: 0,
        recent: [] as Array<{
          id: string;
          source?: "handoff" | "direct";
          status: string;
          assignedAt: string;
          salesOrderId: string;
          poReference: string;
          organizationName: string | null;
          orderStatus: string | null;
          orderTimeline: Array<{ step?: string }>;
          purchaseOrderRequirement?: {
            requirementItemId: string;
            title: string;
            status: string;
            statusReason: string | null;
            updatedAt: string;
            evidence: Array<{
              id: string;
              fileName: string;
              uploadedAt: string;
              signedUrl: string | null;
            }>;
          } | null;
        }>,
        additionalRecent: [] as Array<{
          id: string;
          source?: "handoff" | "direct";
          status: string;
          assignedAt: string;
          salesOrderId: string;
          poReference: string;
          organizationName: string | null;
          orderStatus: string | null;
          orderTimeline: Array<{ step?: string }>;
          purchaseOrderRequirement?: {
            requirementItemId: string;
            title: string;
            status: string;
            statusReason: string | null;
            updatedAt: string;
            evidence: Array<{
              id: string;
              fileName: string;
              uploadedAt: string;
              signedUrl: string | null;
            }>;
          } | null;
        }>,
      },
    [payload?.purchaseOrders],
  );
  const logisticsWorkOrders = useMemo(
    () =>
      payload?.logisticsWorkOrders ?? {
        total: 0,
        pendingAcceptance: 0,
        accepted: 0,
        inProgress: 0,
        completed: 0,
        rejected: 0,
        recent: [] as Array<{
          id: string;
          status: string;
          assignedAt: string;
          salesOrderId: string;
          poReference: string;
          organizationName: string | null;
          orderStatus: string | null;
          orderTimeline: Array<{ step?: string }>;
          purchaseOrderRequirement?: {
            requirementItemId: string;
            title: string;
            status: string;
            statusReason: string | null;
            updatedAt: string;
            evidence: Array<{
              id: string;
              fileName: string;
              uploadedAt: string;
              signedUrl: string | null;
            }>;
          } | null;
        }>,
        additionalRecent: [] as Array<{
          id: string;
          status: string;
          assignedAt: string;
          salesOrderId: string;
          poReference: string;
          organizationName: string | null;
          orderStatus: string | null;
          orderTimeline: Array<{ step?: string }>;
          purchaseOrderRequirement?: {
            requirementItemId: string;
            title: string;
            status: string;
            statusReason: string | null;
            updatedAt: string;
            evidence: Array<{
              id: string;
              fileName: string;
              uploadedAt: string;
              signedUrl: string | null;
            }>;
          } | null;
        }>,
        all: [] as Array<{
          id: string;
          status: string;
          assignedAt: string;
          salesOrderId: string;
          poReference: string;
          organizationName: string | null;
          orderStatus: string | null;
          orderTimeline: Array<{ step?: string }>;
          purchaseOrderRequirement?: {
            requirementItemId: string;
            title: string;
            status: string;
            statusReason: string | null;
            updatedAt: string;
            evidence: Array<{
              id: string;
              fileName: string;
              uploadedAt: string;
              signedUrl: string | null;
            }>;
          } | null;
        }>,
      },
    [payload?.logisticsWorkOrders],
  );
  const visibleLogisticsWorkOrders =
    logisticsWorkOrders.recent.length > 0
      ? logisticsWorkOrders.recent
      : (logisticsWorkOrders.all ?? []);
  usePartnerDashboardActions({
    submitDecision,
    confirmPurchaseOrder,
    advanceSalesOrderFromCard,
    triggerSalesActionWithOptionalInputs,
    submitPurchaseOrderReview,
    updateLogisticsHandoffStatus,
    uploadDocsAndCompleteHandoff,
  });

  useEffect(() => {
    if (!payload) {
      return;
    }

    logPartnerDashboardDiagnostics({
      tag: "[PartnerDashboard] payload",
      payload,
    });

    console.info("[PartnerDashboard] Rendered workflow snapshot", {
      purchaseOrders: {
        total: purchaseOrders.total,
        active: purchaseOrders.active,
        pendingAction: purchaseOrders.pendingAction,
        recent: purchaseOrders.recent.map((item) => ({
          id: item.id,
          source: item.source ?? "unknown",
          poReference: item.poReference,
          status: item.status,
          orderStatus: item.orderStatus,
        })),
      },
      logisticsWorkOrders: {
        total: logisticsWorkOrders.total,
        pendingAcceptance: logisticsWorkOrders.pendingAcceptance,
        accepted: logisticsWorkOrders.accepted,
        inProgress: logisticsWorkOrders.inProgress,
        completed: logisticsWorkOrders.completed,
        rejected: logisticsWorkOrders.rejected,
        allCount: logisticsWorkOrders.all?.length ?? 0,
        recent: logisticsWorkOrders.recent.map((item) => ({
          id: item.id,
          poReference: item.poReference,
          status: item.status,
          orderStatus: item.orderStatus,
        })),
        all: (logisticsWorkOrders.all ?? []).map((item) => ({
          id: item.id,
          poReference: item.poReference,
          status: item.status,
          orderStatus: item.orderStatus,
        })),
      },
    });

    if (!isLogisticsPartner) {
      const currentPurchaseOrder = purchaseOrders.recent[0] ?? null;
      const currentWorkflowSnapshot = currentPurchaseOrder
        ? buildWorkflowStepSnapshot({
            orderStatus: currentPurchaseOrder.orderStatus ?? "",
            orderTimeline: currentPurchaseOrder.orderTimeline,
          })
        : null;

      console.info("[PartnerDashboard] Current purchase order status", {
        orderId: currentPurchaseOrder?.salesOrderId ?? null,
        poReference: currentPurchaseOrder?.poReference ?? null,
        source: currentPurchaseOrder?.source ?? "unknown",
        handoffStatus: currentPurchaseOrder?.status ?? null,
        orderStatus: currentPurchaseOrder?.orderStatus ?? null,
        purchaseOrderCount: purchaseOrders.total,
        workflowSteps: currentWorkflowSnapshot,
      });
    }

    if (isLogisticsPartner) {
      console.info("[PartnerDashboard] Rendering logistics dashboard state", {
        logisticsWorkOrders,
        hasHandoffSection: true,
        hasAssignedWorkOrders: logisticsWorkOrders.total > 0,
        assignedStates: logisticsWorkOrders.recent.map((item) => ({
          id: item.id,
          poReference: item.poReference,
          handoffStatus: item.status,
          workflowState: item.orderStatus,
          workflowSteps: buildWorkflowStepSnapshot({
            orderStatus: item.orderStatus ?? "",
            orderTimeline: item.orderTimeline,
          }),
        })),
      });
      return;
    }

    console.debug(
      "[PartnerDashboard] Rendering non-logistics dashboard state",
      {
        offeredServiceStream: payload.partner.offeredServiceStream,
        isLogistics: payload.partner.isLogistics ?? false,
      },
    );
  }, [isLogisticsPartner, logisticsWorkOrders, payload, purchaseOrders]);

  if (loading) {
    return <DashboardLoadingSkeleton metricCount={5} listCount={4} />;
  }

  if (error) {
    return <div className="py-10 text-center text-red-300">{error}</div>;
  }

  return (
    <>
      {pendingSalesStepAction ? (
        <WorkflowStepInputModal
          stepKey={pendingSalesStepAction.stepKey}
          orderId={pendingSalesStepAction.salesOrderId}
          actionLabel={pendingSalesStepAction.label}
          onClose={() => {
            if (!processingSalesAdvanceKey) {
              setPendingSalesStepAction(null);
            }
          }}
          onConfirm={async (inputData, actorNotes) => {
            const err = await advanceSalesOrderFromCard({
              salesOrderId: pendingSalesStepAction.salesOrderId,
              action: pendingSalesStepAction.action,
              label: pendingSalesStepAction.label,
              stepInputData: inputData,
              actorNotes,
            });

            if (!err) {
              setPendingSalesStepAction(null);
            }

            return err;
          }}
        />
      ) : null}
      {pendingLogisticsStepAction ? (
        <WorkflowStepInputModal
          stepKey={pendingLogisticsStepAction.stepKey}
          orderId={pendingLogisticsStepAction.salesOrderId}
          actionLabel={pendingLogisticsStepAction.label}
          onClose={() => {
            if (!processingHandoffActionKey) {
              setPendingLogisticsStepAction(null);
            }
          }}
          onConfirm={async (inputData, actorNotes) => {
            const err = await updateLogisticsHandoffStatus(
              pendingLogisticsStepAction.handoffId,
              pendingLogisticsStepAction.action,
              {
                salesOrderId: pendingLogisticsStepAction.salesOrderId,
                stepInputData: inputData,
                actorNotes,
              },
            );

            if (!err) {
              setPendingLogisticsStepAction(null);
            }

            return err;
          }}
        />
      ) : null}
      {pendingReturnToSalesAction ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10"
          role="dialog"
          aria-modal="true"
          aria-label="Return handoff to sales"
          onClick={() => {
            if (!processingHandoffActionKey) {
              setPendingReturnToSalesAction(null);
              setReturnToSalesReason("");
              setReturnToSalesError(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-700/80">
              Logistics Return
            </p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">
              {pendingReturnToSalesAction.title}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Add a mandatory reason so sales knows exactly what to fix before
              reassignment.
            </p>

            <label
              htmlFor="return-to-sales-reason"
              className="mt-4 block text-xs font-medium text-slate-700"
            >
              Rejection Reason
            </label>
            <textarea
              id="return-to-sales-reason"
              className="mt-1 h-28 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 outline-none focus:border-cyan-500"
              value={returnToSalesReason}
              onChange={(event) => {
                setReturnToSalesReason(event.target.value);
                if (returnToSalesError) {
                  setReturnToSalesError(null);
                }
              }}
              placeholder="Explain what sales must correct before creating a new handoff..."
            />
            {returnToSalesError ? (
              <p className="mt-2 text-xs text-rose-600">{returnToSalesError}</p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (!processingHandoffActionKey) {
                    setPendingReturnToSalesAction(null);
                    setReturnToSalesReason("");
                    setReturnToSalesError(null);
                  }
                }}
                disabled={processingHandoffActionKey !== null}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitReturnToSalesWithReason()}
                disabled={processingHandoffActionKey !== null}
              >
                Return To Sales
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-6">
        <DashboardPageHeader
          title="Partner Dashboard"
          subtitle={
            isLogisticsPartner
              ? "Inbound logistics handoffs, execution progress, and completion tracking."
              : "Ping-first request operations for partner decisioning and customer-doc readiness."
          }
          subtitleClassName="mt-2 text-sm text-slate-600"
          badge={
            <Badge>
              {isLogisticsPartner
                ? `${logisticsWorkOrders.total} Total Work Orders`
                : `${summary.total} Total Requests`}
            </Badge>
          }
        />

        {!isLogisticsPartner && purchaseOrders.active > 0 ? (
          <WorkflowOpsSectionShell
            tone="cyan"
            title={
              purchaseOrders.pendingAction > 0
                ? "Purchase Order Received • Confirmation Required"
                : "Purchase Order Received"
            }
            description={
              purchaseOrders.pendingAction > 0
                ? `${purchaseOrders.pendingAction} purchase order${purchaseOrders.pendingAction === 1 ? "" : "s"} awaiting your confirmation.`
                : `${purchaseOrders.active} active purchase order${purchaseOrders.active === 1 ? "" : "s"} in progress.`
            }
          >
            <InlineErrorMessage className="mt-1" message={poConfirmError} />
            <InlineErrorMessage className="mt-1" message={poReviewError} />

            <div className="mt-4 space-y-4">
              {purchaseOrders.recent.map((item) => {
                const completedStepKeys = (item.orderTimeline ?? [])
                  .map((entry) => entry.step)
                  .filter((step): step is string => Boolean(step));

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    {(() => {
                      const isDirectSalesOrder =
                        item.source === "direct" ||
                        item.id.startsWith("sales-order-");
                      const hasReceiptConfirmed = hasTimelineStep(
                        item.orderTimeline,
                        "purchase_order_received",
                      );
                      const showConfirmButton =
                        isDirectSalesOrder && !hasReceiptConfirmed;

                      const poRequirement =
                        item.purchaseOrderRequirement ?? null;
                      const poRequirementApproved =
                        !poRequirement || poRequirement.status === "approved";
                      const poReviewDecisionRecorded =
                        !poRequirement || poRequirement.status !== "submitted";
                      const confirmLockedByPoReview =
                        showConfirmButton && !poReviewDecisionRecorded;

                      const status = item.orderStatus ?? "";
                      const canValidate =
                        hasReceiptConfirmed &&
                        status === "Purchase Order Received" &&
                        poRequirementApproved;
                      const canReserveInventory = status === "Order Validated";
                      const canCreateHandoff = status === "Inventory Reserved";
                      const canRollbackInventory =
                        status === "Inventory Reserved";
                      const canRollbackValidation =
                        status === "Order Validated";
                      const hasHandoffCreated =
                        status === "Logistics Handoff Created" ||
                        status === "Invoice Generated" ||
                        status === "Shipment Created" ||
                        status === "Delivered";

                      const validateDone =
                        status === "Order Validated" ||
                        status === "Inventory Reserved" ||
                        status === "Logistics Handoff Created" ||
                        status === "Invoice Generated" ||
                        status === "Shipment Created" ||
                        status === "Delivered";

                      const reserveDone =
                        status === "Inventory Reserved" ||
                        status === "Logistics Handoff Created" ||
                        status === "Invoice Generated" ||
                        status === "Shipment Created" ||
                        status === "Delivered";

                      const handoffDone =
                        status === "Logistics Handoff Created" ||
                        status === "Invoice Generated" ||
                        status === "Shipment Created" ||
                        status === "Delivered";

                      type SalesControlStepState =
                        | "done"
                        | "active"
                        | "upcoming";

                      const validateState: SalesControlStepState = validateDone
                        ? "done"
                        : canValidate
                          ? "active"
                          : "upcoming";

                      const reserveState: SalesControlStepState = reserveDone
                        ? "done"
                        : canReserveInventory
                          ? "active"
                          : "upcoming";

                      const handoffState: SalesControlStepState = handoffDone
                        ? "done"
                        : canCreateHandoff
                          ? "active"
                          : "upcoming";

                      return (
                        <>
                          <EntityHeaderRow
                            title={item.poReference}
                            subtitle={item.organizationName}
                            right={
                              showConfirmButton ? (
                                <div className="flex flex-col items-end gap-1">
                                  <Button
                                    className={`h-8 rounded-md px-3 text-xs font-semibold ${
                                      confirmLockedByPoReview
                                        ? "bg-slate-200 text-slate-700 hover:bg-slate-200"
                                        : "bg-emerald-500/90 text-slate-950 hover:bg-emerald-400"
                                    }`}
                                    disabled={
                                      confirmingPoId === item.id ||
                                      confirmLockedByPoReview
                                    }
                                    onClick={() =>
                                      void confirmPurchaseOrder({
                                        id: item.id,
                                        salesOrderId: item.salesOrderId,
                                      })
                                    }
                                  >
                                    {confirmingPoId === item.id
                                      ? "Updating..."
                                      : "Confirm Receipt"}
                                  </Button>
                                  {confirmLockedByPoReview ? (
                                    <p className="text-[11px] text-slate-700">
                                      Review decision required first (Approve PO
                                      or Request Resubmission).
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="text-right">
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] text-emerald-700">
                                    Confirmed
                                  </span>
                                  <p className="mt-1 text-[11px] text-cyan-700">
                                    {getPurchaseOrderProgressLabel(
                                      item.orderStatus,
                                    )}
                                  </p>
                                </div>
                              )
                            }
                          />
                          {poRequirement ? (
                            <div className="mb-3 rounded-md border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                                Purchase Order Document Review
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                Status: {poRequirement.status}
                                {poRequirement.statusReason
                                  ? ` • ${poRequirement.statusReason}`
                                  : ""}
                              </p>

                              {poRequirement.evidence.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {poRequirement.evidence.map((file) => (
                                    <div
                                      key={file.id}
                                      className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1"
                                    >
                                      <div>
                                        <p className="text-[11px] text-slate-900">
                                          {file.fileName}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          Uploaded{" "}
                                          {new Date(
                                            file.uploadedAt,
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                      {file.signedUrl ? (
                                        <a
                                          href={file.signedUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[11px] font-semibold text-cyan-700 underline underline-offset-2"
                                        >
                                          View
                                        </a>
                                      ) : (
                                        <span className="text-[10px] text-slate-500">
                                          Unavailable
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] text-slate-600">
                                  No uploaded PO evidence found yet.
                                </p>
                              )}

                              {poRequirement.status !== "approved" ? (
                                <div className="mt-3 space-y-2">
                                  <textarea
                                    value={
                                      poReviewReasonByRequirement[
                                        poRequirement.requirementItemId
                                      ] ?? ""
                                    }
                                    onChange={(event) =>
                                      setPoReviewReasonByRequirement(
                                        (current) => ({
                                          ...current,
                                          [poRequirement.requirementItemId]:
                                            event.target.value,
                                        }),
                                      )
                                    }
                                    rows={2}
                                    placeholder="Reason required when rejecting / requesting resubmission"
                                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      className="h-7 rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                                      disabled={
                                        processingPoReviewRequirementId ===
                                        poRequirement.requirementItemId
                                      }
                                      onClick={() =>
                                        void submitPurchaseOrderReview({
                                          requirementItemId:
                                            poRequirement.requirementItemId,
                                          action: "approve",
                                        })
                                      }
                                    >
                                      {processingPoReviewRequirementId ===
                                      poRequirement.requirementItemId
                                        ? "Saving..."
                                        : "Approve PO"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="h-7 rounded-md border border-red-300 px-2.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                                      disabled={
                                        processingPoReviewRequirementId ===
                                          poRequirement.requirementItemId ||
                                        (
                                          poReviewReasonByRequirement[
                                            poRequirement.requirementItemId
                                          ] ?? ""
                                        ).trim().length < 6
                                      }
                                      onClick={() =>
                                        void submitPurchaseOrderReview({
                                          requirementItemId:
                                            poRequirement.requirementItemId,
                                          action: "request_resubmission",
                                          reason: (
                                            poReviewReasonByRequirement[
                                              poRequirement.requirementItemId
                                            ] ?? ""
                                          ).trim(),
                                        })
                                      }
                                    >
                                      Request Resubmission
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] text-emerald-700">
                                  PO document approved. Sales validation can
                                  continue.
                                </p>
                              )}
                            </div>
                          ) : null}
                          <StepStateChipsRow
                            chips={[
                              {
                                key: "validate",
                                label:
                                  validateState === "done"
                                    ? "Validate Done"
                                    : "Validate Order",
                                state: validateState,
                              },
                              {
                                key: "reserve",
                                label:
                                  reserveState === "done"
                                    ? "Reserved"
                                    : "Reserve Inventory",
                                state: reserveState,
                              },
                              {
                                key: "handoff",
                                label:
                                  handoffState === "done"
                                    ? "Handoff Created"
                                    : "Create Handoff",
                                state: handoffState,
                              },
                            ]}
                          />

                          <div className="mb-3">
                            <WorkflowStepActions
                              actions={[
                                ...(canValidate
                                  ? [
                                      {
                                        key: `${item.salesOrderId}:validate`,
                                        label: "Proceed: Validate Order",
                                        loading:
                                          processingSalesAdvanceKey ===
                                          `${item.salesOrderId}:validate`,
                                        onClick: () =>
                                          triggerSalesActionWithOptionalInputs({
                                            salesOrderId: item.salesOrderId,
                                            action: "validate",
                                            label: "Validate Order",
                                          }),
                                        disabled:
                                          processingSalesAdvanceKey !== null ||
                                          confirmingPoId === item.id,
                                      },
                                    ]
                                  : []),
                                ...(canReserveInventory
                                  ? [
                                      {
                                        key: `${item.salesOrderId}:reserve_inventory`,
                                        label: "Proceed: Reserve Inventory",
                                        loading:
                                          processingSalesAdvanceKey ===
                                          `${item.salesOrderId}:reserve_inventory`,
                                        onClick: () =>
                                          triggerSalesActionWithOptionalInputs({
                                            salesOrderId: item.salesOrderId,
                                            action: "reserve_inventory",
                                            label: "Reserve Inventory",
                                          }),
                                        disabled:
                                          processingSalesAdvanceKey !== null ||
                                          confirmingPoId === item.id,
                                      },
                                    ]
                                  : []),
                                ...(canCreateHandoff
                                  ? [
                                      {
                                        key: `${item.salesOrderId}:create_handoff`,
                                        label: "Proceed: Create Handoff",
                                        loading:
                                          processingSalesAdvanceKey ===
                                          `${item.salesOrderId}:create_handoff`,
                                        onClick: () =>
                                          triggerSalesActionWithOptionalInputs({
                                            salesOrderId: item.salesOrderId,
                                            action: "create_handoff",
                                            label: "Create Logistics Handoff",
                                          }),
                                        disabled:
                                          processingSalesAdvanceKey !== null ||
                                          confirmingPoId === item.id,
                                      },
                                    ]
                                  : []),
                                ...(!hasHandoffCreated &&
                                (canRollbackInventory || canRollbackValidation)
                                  ? [
                                      {
                                        key: `${item.salesOrderId}:${canRollbackInventory ? "rollback_inventory" : "rollback_validation"}`,
                                        label: canRollbackInventory
                                          ? "Go Back: Validate Order"
                                          : "Go Back: PO Received",
                                        loading:
                                          processingSalesAdvanceKey ===
                                          `${item.salesOrderId}:${canRollbackInventory ? "rollback_inventory" : "rollback_validation"}`,
                                        onClick: () =>
                                          triggerSalesActionWithOptionalInputs({
                                            salesOrderId: item.salesOrderId,
                                            action: canRollbackInventory
                                              ? "rollback_inventory"
                                              : "rollback_validation",
                                            label: canRollbackInventory
                                              ? "Back to Validate Order"
                                              : "Back to PO Received",
                                          }),
                                        disabled:
                                          processingSalesAdvanceKey !== null ||
                                          confirmingPoId === item.id,
                                        tone: "backward" as const,
                                      },
                                    ]
                                  : []),
                              ]}
                            />

                            {!canValidate &&
                            hasReceiptConfirmed &&
                            status === "Purchase Order Received" &&
                            !poRequirementApproved ? (
                              <p className="text-[11px] text-slate-700 dark:text-slate-300">
                                Validate Order is locked until the uploaded PO
                                document is approved.
                              </p>
                            ) : null}

                            {hasHandoffCreated ? (
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                Backward navigation is disabled after handoff
                                creation.
                              </p>
                            ) : null}
                          </div>
                          <SequencedActionHint message="Sales control points advance in strict sequence. Only the current required step is actionable." />
                        </>
                      );
                    })()}
                    <WorkflowProgressPanel
                      variant="sales"
                      compact={false}
                      completedStepKeys={
                        completedStepKeys.length > 0
                          ? completedStepKeys
                          : undefined
                      }
                      currentIndex={getWorkflowStageIndexFromSalesOrder({
                        status: item.orderStatus ?? "",
                        timeline: item.orderTimeline,
                      })}
                    />
                  </div>
                );
              })}

              <AdditionalItemsPillList
                title="Other Active Purchase Orders"
                items={(purchaseOrders.additionalRecent ?? []).map((item) => ({
                  key: `po-additional-${item.id}`,
                  label: item.poReference,
                }))}
              />
            </div>
          </WorkflowOpsSectionShell>
        ) : null}

        {isLogisticsPartner ? (
          <WorkflowOpsSectionShell
            tone="cyan"
            title={getLogisticsWorkOrderHeading(logisticsWorkOrders)}
            description={
              logisticsWorkOrders.pendingAcceptance > 0
                ? `${logisticsWorkOrders.pendingAcceptance} handoff${logisticsWorkOrders.pendingAcceptance === 1 ? "" : "s"} waiting acceptance.`
                : logisticsWorkOrders.accepted > 0
                  ? `${logisticsWorkOrders.accepted} handoff${logisticsWorkOrders.accepted === 1 ? "" : "s"} confirmed and ready to start.`
                  : `${logisticsWorkOrders.inProgress} handoff${logisticsWorkOrders.inProgress === 1 ? "" : "s"} currently in progress.`
            }
          >
            <InlineErrorMessage
              className="mt-1"
              message={handoffConfirmError}
            />

            <div className="mt-4 space-y-4">
              {visibleLogisticsWorkOrders.length === 0 ? (
                <EmptyStateNoticeCard
                  title="No active logistics handoffs"
                  description="New inbound handoffs from sales will appear here."
                />
              ) : null}
              {visibleLogisticsWorkOrders.map((item) => {
                const completedStepKeys = (item.orderTimeline ?? [])
                  .map((entry) => entry.step)
                  .filter((step): step is string => Boolean(step));
                const normalizedCompletedStepKeys =
                  normalizeWorkflowCompletedStepKeys(completedStepKeys);
                const completedLogisticsStepSet = new Set(
                  normalizedCompletedStepKeys,
                );
                const logisticsCheckpoints = getLogisticsCheckpoints({
                  status: item.status,
                  completedStepKeys: normalizedCompletedStepKeys,
                });

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-300 bg-slate-50 p-3"
                  >
                    {(() => {
                      type LogisticsControlStepState =
                        | "done"
                        | "active"
                        | "upcoming";

                      const canAccept = item.status === "pending";
                      const canStart = item.status === "accepted";
                      const canComplete = item.status === "in_progress";
                      const canReject = item.status === "pending";
                      const canReturnToSales = item.status === "accepted";
                      const canRollbackToStarted =
                        item.status === "in_progress";
                      const canNotifyCustomer =
                        canComplete &&
                        !completedLogisticsStepSet.has("notify_customer");
                      const canPackItems =
                        canComplete &&
                        completedLogisticsStepSet.has("notify_customer") &&
                        !completedLogisticsStepSet.has(
                          "pack_items_for_shipment",
                        );
                      const canTrackInTransit =
                        canComplete &&
                        completedLogisticsStepSet.has(
                          "pack_items_for_shipment",
                        ) &&
                        !completedLogisticsStepSet.has(
                          "track_shipment_in_transit",
                        );
                      const canMarkArrived =
                        canComplete &&
                        completedLogisticsStepSet.has(
                          "track_shipment_in_transit",
                        ) &&
                        !completedLogisticsStepSet.has(
                          "order_arrives_at_destination",
                        );
                      const canCapturePod =
                        canComplete &&
                        completedLogisticsStepSet.has(
                          "order_arrives_at_destination",
                        ) &&
                        !completedLogisticsStepSet.has(
                          "customer_receives_signs_pod",
                        );
                      const canCloseSystem =
                        canComplete &&
                        completedLogisticsStepSet.has(
                          "customer_receives_signs_pod",
                        ) &&
                        !completedLogisticsStepSet.has(
                          "blubook_system_updated",
                        );
                      const canCompleteUpload =
                        canComplete &&
                        completedLogisticsStepSet.has(
                          "customer_receives_signs_pod",
                        ) &&
                        completedLogisticsStepSet.has("blubook_system_updated");

                      const acceptDone =
                        item.status === "accepted" ||
                        item.status === "in_progress" ||
                        item.status === "completed";

                      const startDone =
                        item.status === "in_progress" ||
                        item.status === "completed";

                      const completeDone = item.status === "completed";

                      const acceptState: LogisticsControlStepState = acceptDone
                        ? "done"
                        : canAccept
                          ? "active"
                          : "upcoming";

                      const startState: LogisticsControlStepState = startDone
                        ? "done"
                        : canStart
                          ? "active"
                          : "upcoming";

                      const completeState: LogisticsControlStepState =
                        completeDone
                          ? "done"
                          : canComplete
                            ? "active"
                            : "upcoming";

                      return (
                        <>
                          <EntityHeaderRow
                            title={item.poReference}
                            subtitle={item.organizationName}
                            right={
                              item.status === "completed" ? (
                                <Button
                                  className="h-8 rounded-md bg-slate-500/90 px-3 text-xs font-semibold text-white hover:bg-slate-400"
                                  onClick={() =>
                                    router.push("/partner/work-orders")
                                  }
                                >
                                  View Details
                                </Button>
                              ) : (
                                <div className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-[11px] text-emerald-800">
                                  In Progress
                                </div>
                              )
                            }
                          />

                          <div className="mb-2 grid gap-1 sm:grid-cols-2">
                            <p className="text-[11px] text-slate-600">
                              Sales handoff status:{" "}
                              {item.orderStatus ?? "Unknown"}
                            </p>
                            <p className="text-[11px] text-slate-600 sm:text-right">
                              Latest checkpoint:{" "}
                              {completedStepKeys.length > 0
                                ? formatStepKeyLabel(
                                    completedStepKeys[
                                      completedStepKeys.length - 1
                                    ]!,
                                  )
                                : "Awaiting first logistics event"}
                            </p>
                          </div>

                          {item.purchaseOrderRequirement ? (
                            <div className="mb-2 rounded-md border border-slate-200 bg-white p-2">
                              <p className="text-[11px] font-semibold text-slate-800">
                                Purchase Order Document
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                Status: {item.purchaseOrderRequirement.status}
                              </p>
                              {item.purchaseOrderRequirement.evidence[0]
                                ?.signedUrl ? (
                                <a
                                  href={
                                    item.purchaseOrderRequirement.evidence[0]
                                      .signedUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-block text-[11px] font-semibold text-cyan-700 underline underline-offset-2"
                                >
                                  View PO File:{" "}
                                  {
                                    item.purchaseOrderRequirement.evidence[0]
                                      .fileName
                                  }
                                </a>
                              ) : (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  No PO file available.
                                </p>
                              )}
                            </div>
                          ) : null}

                          <StepStateChipsRow
                            chips={[
                              {
                                key: "accept",
                                label:
                                  acceptState === "done"
                                    ? "Handoff Accepted"
                                    : "Accept Handoff",
                                state: acceptState,
                              },
                              {
                                key: "start",
                                label:
                                  startState === "done"
                                    ? "Warehouse Processing Started"
                                    : WORKFLOW_ACTION_LABELS.logisticsActivate,
                                state: startState,
                              },
                              {
                                key: "complete",
                                label:
                                  completeState === "done"
                                    ? "Delivered"
                                    : WORKFLOW_ACTION_LABELS.logisticsDeliver,
                                state: completeState,
                              },
                            ]}
                          />

                          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                            <p className="text-[11px] font-semibold text-slate-700">
                              Logistics checkpoint tracking
                            </p>
                            <div className="mt-1 grid gap-1 sm:grid-cols-2">
                              {logisticsCheckpoints.map((checkpoint) => (
                                <div
                                  key={`${item.id}-${checkpoint.key}`}
                                  className="flex items-center gap-2 text-[11px]"
                                >
                                  <span
                                    className={`inline-block h-2 w-2 border ${
                                      checkpoint.completed
                                        ? "border-emerald-500 bg-emerald-500"
                                        : "border-slate-400 bg-transparent"
                                    }`}
                                  />
                                  <span
                                    className={
                                      checkpoint.completed
                                        ? "text-emerald-700"
                                        : "text-slate-600"
                                    }
                                  >
                                    {checkpoint.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <WorkflowStepActions
                            actions={[
                              ...(canAccept
                                ? [
                                    {
                                      key: `${item.id}:accept`,
                                      label: "Proceed: Accept Handoff",
                                      loading:
                                        processingHandoffActionKey ===
                                        `${item.id}:accept`,
                                      onClick: () =>
                                        triggerLogisticsActionWithOptionalInputs(
                                          {
                                            handoffId: item.id,
                                            salesOrderId: item.salesOrderId,
                                            action: "accept",
                                            label: "Proceed: Accept Handoff",
                                          },
                                        ),
                                      disabled:
                                        processingHandoffActionKey !== null,
                                    },
                                  ]
                                : []),
                              ...(canStart
                                ? [
                                    {
                                      key: `${item.id}:start`,
                                      label:
                                        "Proceed: Start Warehouse Processing",
                                      loading:
                                        processingHandoffActionKey ===
                                        `${item.id}:start`,
                                      onClick: () =>
                                        triggerLogisticsActionWithOptionalInputs(
                                          {
                                            handoffId: item.id,
                                            salesOrderId: item.salesOrderId,
                                            action: "start",
                                            label:
                                              "Proceed: Start Warehouse Processing",
                                          },
                                        ),
                                      disabled:
                                        processingHandoffActionKey !== null,
                                    },
                                  ]
                                : []),
                              ...(canReject
                                ? [
                                    {
                                      key: `${item.id}:reject-pending`,
                                      label: "Go Back: Reject Handoff To Sales",
                                      loading:
                                        processingHandoffActionKey ===
                                        `${item.id}:reject`,
                                      onClick: () =>
                                        setPendingReturnToSalesAction({
                                          handoffId: item.id,
                                          title: "Return To Sales",
                                        }),
                                      disabled:
                                        processingHandoffActionKey !== null,
                                      tone: "backward" as const,
                                    },
                                  ]
                                : []),
                              ...(canReturnToSales
                                ? [
                                    {
                                      key: `${item.id}:return-to-sales`,
                                      label: "Go Back: Return To Sales",
                                      loading:
                                        processingHandoffActionKey ===
                                        `${item.id}:reject`,
                                      onClick: () =>
                                        setPendingReturnToSalesAction({
                                          handoffId: item.id,
                                          title: "Return To Sales",
                                        }),
                                      disabled:
                                        processingHandoffActionKey !== null,
                                      tone: "backward" as const,
                                    },
                                  ]
                                : []),
                              ...(canComplete
                                ? [
                                    {
                                      key: `${item.id}:rollback-start`,
                                      label: "Go Back: Handoff Accepted",
                                      loading:
                                        processingHandoffActionKey ===
                                        `${item.id}:rollback_start`,
                                      onClick: () =>
                                        void updateLogisticsHandoffStatus(
                                          item.id,
                                          "rollback_start",
                                        ),
                                      disabled:
                                        processingHandoffActionKey !== null,
                                      tone: "backward" as const,
                                    },
                                    ...(canNotifyCustomer
                                      ? [
                                          {
                                            key: `${item.id}:notify_customer`,
                                            label: "Proceed: Notify Customer",
                                            loading:
                                              processingHandoffActionKey ===
                                              `${item.id}:notify_customer`,
                                            onClick: () =>
                                              triggerLogisticsActionWithOptionalInputs(
                                                {
                                                  handoffId: item.id,
                                                  salesOrderId:
                                                    item.salesOrderId,
                                                  action: "notify_customer",
                                                  label:
                                                    "Proceed: Notify Customer",
                                                },
                                              ),
                                            disabled:
                                              processingHandoffActionKey !==
                                              null,
                                          },
                                        ]
                                      : []),
                                    ...(canPackItems
                                      ? [
                                          {
                                            key: `${item.id}:pack_items`,
                                            label:
                                              "Proceed: Pack Items For Shipment",
                                            loading:
                                              processingHandoffActionKey ===
                                              `${item.id}:pack_items`,
                                            onClick: () =>
                                              triggerLogisticsActionWithOptionalInputs(
                                                {
                                                  handoffId: item.id,
                                                  salesOrderId:
                                                    item.salesOrderId,
                                                  action: "pack_items",
                                                  label:
                                                    "Proceed: Pack Items For Shipment",
                                                },
                                              ),
                                            disabled:
                                              processingHandoffActionKey !==
                                              null,
                                          },
                                        ]
                                      : []),
                                    ...(canTrackInTransit
                                      ? [
                                          {
                                            key: `${item.id}:in_transit`,
                                            label:
                                              "Proceed: Mark Shipment In Transit",
                                            loading:
                                              processingHandoffActionKey ===
                                              `${item.id}:in_transit`,
                                            onClick: () =>
                                              triggerLogisticsActionWithOptionalInputs(
                                                {
                                                  handoffId: item.id,
                                                  salesOrderId:
                                                    item.salesOrderId,
                                                  action: "in_transit",
                                                  label:
                                                    "Proceed: Mark Shipment In Transit",
                                                },
                                              ),
                                            disabled:
                                              processingHandoffActionKey !==
                                              null,
                                          },
                                        ]
                                      : []),
                                    ...(canMarkArrived
                                      ? [
                                          {
                                            key: `${item.id}:arrived`,
                                            label:
                                              "Proceed: Confirm Arrival At Destination",
                                            loading:
                                              processingHandoffActionKey ===
                                              `${item.id}:arrived`,
                                            onClick: () =>
                                              triggerLogisticsActionWithOptionalInputs(
                                                {
                                                  handoffId: item.id,
                                                  salesOrderId:
                                                    item.salesOrderId,
                                                  action: "arrived",
                                                  label:
                                                    "Proceed: Confirm Arrival At Destination",
                                                },
                                              ),
                                            disabled:
                                              processingHandoffActionKey !==
                                              null,
                                          },
                                        ]
                                      : []),
                                    ...(canCapturePod
                                      ? [
                                          {
                                            key: `${item.id}:pod_signed`,
                                            label:
                                              "Proceed: Capture POD Signature",
                                            loading:
                                              processingHandoffActionKey ===
                                              `${item.id}:pod_signed`,
                                            onClick: () =>
                                              triggerLogisticsActionWithOptionalInputs(
                                                {
                                                  handoffId: item.id,
                                                  salesOrderId:
                                                    item.salesOrderId,
                                                  action: "pod_signed",
                                                  label:
                                                    "Proceed: Capture POD Signature",
                                                },
                                              ),
                                            disabled:
                                              processingHandoffActionKey !==
                                              null,
                                          },
                                        ]
                                      : []),
                                    ...(canCloseSystem
                                      ? [
                                          {
                                            key: `${item.id}:system_updated`,
                                            label:
                                              "Proceed: Mark BluBook System Updated",
                                            loading:
                                              processingHandoffActionKey ===
                                              `${item.id}:system_updated`,
                                            onClick: () =>
                                              triggerLogisticsActionWithOptionalInputs(
                                                {
                                                  handoffId: item.id,
                                                  salesOrderId:
                                                    item.salesOrderId,
                                                  action: "system_updated",
                                                  label:
                                                    "Proceed: Mark BluBook System Updated",
                                                },
                                              ),
                                            disabled:
                                              processingHandoffActionKey !==
                                              null,
                                          },
                                        ]
                                      : []),
                                    ...(canCompleteUpload
                                      ? [
                                          {
                                            key: `${item.id}:complete`,
                                            label: "Proceed: Complete & Upload",
                                            onClick: () => {
                                              setActiveUploadHandoff({
                                                id: item.id,
                                                poReference: item.poReference,
                                              });
                                              setShippingLabelFile(null);
                                              setProofOfDeliveryFile(null);
                                              setUploadModalError(null);
                                            },
                                            disabled:
                                              processingHandoffActionKey !==
                                              null,
                                          },
                                        ]
                                      : []),
                                  ]
                                : []),
                            ]}
                          />

                          {canComplete && !canCompleteUpload ? (
                            <p className="mt-2 text-[11px] text-slate-600">
                              Complete & Upload unlocks after these logistics
                              checkpoints are captured in sequence: Notify
                              Customer, Pack Items, In Transit, Arrival, POD,
                              and System Updated.
                            </p>
                          ) : null}

                          {canRollbackToStarted ? (
                            <p className="mt-2 text-[11px] text-slate-600">
                              Back path available: move this handoff to Handoff
                              Accepted for corrections.
                            </p>
                          ) : null}

                          {canReject || canReturnToSales ? (
                            <p className="mt-2 text-[11px] text-slate-600">
                              Back path available: return this handoff to sales
                              at the current checkpoint.
                            </p>
                          ) : null}

                          <div className="mb-3">
                            <WorkflowStepMatrix
                              completedStepKeys={completedStepKeys}
                              audience="logistics"
                              title="Detailed Logistics Tracking"
                              description="Includes sales handoff checkpoints, warehouse flow, transit, arrival, POD, and system closeout events."
                            />
                          </div>

                          <SequencedActionHint message="Logistics handoff advances in strict sequence. Only the current required step is actionable." />
                        </>
                      );
                    })()}
                    <WorkflowProgressPanel
                      variant="sales"
                      compact={false}
                      completedStepKeys={
                        completedStepKeys.length > 0
                          ? completedStepKeys
                          : undefined
                      }
                      currentIndex={getWorkflowStageIndexFromSalesOrder({
                        status: item.orderStatus ?? "",
                        timeline: item.orderTimeline,
                      })}
                    />
                  </div>
                );
              })}

              <AdditionalItemsPillList
                title="Other Active Logistics Handoffs"
                items={(logisticsWorkOrders.additionalRecent ?? []).map(
                  (item) => ({
                    key: `handoff-additional-${item.id}`,
                    label: item.poReference,
                  }),
                )}
              />
            </div>
          </WorkflowOpsSectionShell>
        ) : null}

        <MetricsCardGrid
          items={
            isLogisticsPartner
              ? [
                  {
                    key: "pending-acceptance",
                    title: "Pending Acceptance",
                    description:
                      "Inbound handoffs waiting for logistics acceptance.",
                    value: logisticsWorkOrders.pendingAcceptance,
                    icon: BoxesIcon,
                    valueClassName: "text-slate-200",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "accepted",
                    title: "Accepted",
                    description: "Handoffs accepted and ready to begin.",
                    value: logisticsWorkOrders.accepted,
                    icon: ClipboardCheckIcon,
                    valueClassName: "text-cyan-200",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "in-progress",
                    title: "In Progress",
                    description: "Active logistics fulfillment in execution.",
                    value: logisticsWorkOrders.inProgress,
                    icon: HistoryIcon,
                    valueClassName: "text-slate-900",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "completed",
                    title: "Completed",
                    description: "Work orders completed by logistics.",
                    value: logisticsWorkOrders.completed,
                    icon: FileCheckIcon,
                    valueClassName: "text-emerald-300",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "rejected",
                    title: "Rejected",
                    description: "Handoffs rejected by logistics.",
                    value: logisticsWorkOrders.rejected,
                    icon: XIcon,
                    valueClassName: "text-red-300",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                ]
              : [
                  {
                    key: "new-pings",
                    title: "New Pings",
                    description: "Needs accept/reject before execution.",
                    value: summary.sent,
                    icon: BoxesIcon,
                    valueClassName: "text-slate-900",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "accepted",
                    title: "Accepted",
                    description: "Acknowledged requests",
                    value: summary.acknowledged,
                    icon: ClipboardCheckIcon,
                    valueClassName: "text-slate-900",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "rejected",
                    title: "Rejected",
                    description: "Requests rejected by partner.",
                    value: summary.failed,
                    icon: XIcon,
                    valueClassName: "text-slate-300",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "pending-docs",
                    title: "Pending Docs",
                    description: "Accepted pending docs",
                    value: summary.pendingCustomerDocs,
                    icon: ReceiptTextIcon,
                    valueClassName: "text-cyan-200",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                  {
                    key: "ready",
                    title: "Ready",
                    description: "Accepted with required all docs.",
                    value: summary.readyForExecution,
                    icon: FileCheckIcon,
                    valueClassName: "text-emerald-300",
                    titleClampLines: 2,
                    descriptionClampLines: 2,
                  },
                ]
          }
        />

        <Card
          title="Recent Activity"
          description="Latest actions and events across your requests"
        >
          <ActivityTimeline limit={10} />
        </Card>

        {!isLogisticsPartner ? (
          <div className="grid gap-4">
            <Card
              title="Incoming Sales Requests"
              description="Accept or reject incoming sales-order requests."
            >
              <div className="space-y-2.5">
                {newPings.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {newPings.slice(0, 8).map((request) => (
                      <PartnerRequestPingCard key={request.id}>
                        <div className="min-w-0 flex-1 space-y-3.5">
                          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_0_rgba(15,23,42,0.03),0_8px_16px_rgba(15,23,42,0.06)]">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.14)]" />
                                  <p className="truncate text-base font-semibold tracking-tight text-slate-900">
                                    {request.organizationName ||
                                      request.organizationId}
                                  </p>
                                </div>
                                <p className="mt-1 text-[11px] font-medium text-slate-600">
                                  {getStreamDisplayName(request.packageStream)}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                #{request.id.slice(0, 8)}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-700">
                              <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                Tier:{" "}
                                {request.packageTierName ||
                                  request.packageTierCode ||
                                  request.packageId ||
                                  "Unknown"}
                              </span>
                              <span className="rounded-md border border-cyan-300/40 bg-cyan-100 px-2 py-0.5 text-cyan-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                                Docs Completed:{" "}
                                {Math.max(
                                  0,
                                  request.requiredDocsTotal -
                                    request.requiredDocsPending,
                                )}
                                /{request.requiredDocsTotal}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_10px_rgba(15,23,42,0.05)]">
                            <div className="mb-1.5 flex items-center justify-between text-[11px]">
                              <span className="text-slate-600">
                                Document completeness
                              </span>
                              <span className="font-medium text-slate-900">
                                {request.requiredDocsTotal === 0
                                  ? "0%"
                                  : `${Math.round(((request.requiredDocsTotal - request.requiredDocsPending) / request.requiredDocsTotal) * 100)}%`}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-200">
                              <div
                                className="h-1.5 rounded-full bg-cyan-500"
                                style={{
                                  width: `${
                                    request.requiredDocsTotal === 0
                                      ? 0
                                      : Math.max(
                                          8,
                                          Math.min(
                                            100,
                                            ((request.requiredDocsTotal -
                                              request.requiredDocsPending) /
                                              request.requiredDocsTotal) *
                                              100,
                                          ),
                                        )
                                  }%`,
                                }}
                              />
                            </div>
                          </div>

                          {request.aiReadiness.status !==
                          "insufficient_signal" ? (
                            <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_6px_12px_rgba(15,23,42,0.04)]">
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span
                                  className={`rounded-md border px-2 py-0.5 font-medium ${
                                    request.aiReadiness.status === "high"
                                      ? "border-emerald-300/50 bg-emerald-100 text-emerald-800"
                                      : request.aiReadiness.status === "medium"
                                        ? "border-cyan-300/50 bg-cyan-100 text-cyan-800"
                                        : "border-cyan-300/50 bg-cyan-100 text-cyan-800"
                                  }`}
                                >
                                  Readiness: {request.aiReadiness.label}
                                </span>
                                {request.aiReadiness.score !== null ? (
                                  <span className="rounded-md border border-cyan-300/50 bg-cyan-100 px-2 py-0.5 text-cyan-800">
                                    Score {request.aiReadiness.score}
                                  </span>
                                ) : null}
                                {request.aiReadiness.confidence !== null ? (
                                  <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-700">
                                    Confidence{" "}
                                    {Math.round(request.aiReadiness.confidence)}
                                    %
                                  </span>
                                ) : null}
                              </div>

                              {request.aiReadiness.reasons[0] ? (
                                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                                  <p className="text-[11px] text-slate-700">
                                    {request.aiReadiness.reasons[0]}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-500">
                            Timestamp:{" "}
                            {new Date(request.sentAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="mt-5 border-t border-slate-200 pt-3">
                          <div className="flex items-center justify-start gap-2">
                            <ActionButtonWithLoading
                              label="Accept"
                              loading={processingRequestId === request.id}
                              loadingLabel="Updating..."
                              className="h-8 rounded-md bg-emerald-500/90 px-3 text-xs text-slate-950 hover:bg-emerald-400"
                              onClick={() =>
                                void submitDecision(request.id, "accept")
                              }
                            />
                            <ActionButtonWithLoading
                              label="Reject"
                              loading={processingRequestId === request.id}
                              loadingLabel="Updating..."
                              tone="danger"
                              className="h-8 rounded-md px-3 text-xs"
                              onClick={() =>
                                void submitDecision(request.id, "reject")
                              }
                            />
                          </div>
                        </div>
                      </PartnerRequestPingCard>
                    ))}
                  </div>
                ) : null}
                {newPings.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No new request pings.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card
              title="Sales Orders Queue"
              description="Accepted sales-order requests and operational status."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {acceptedRequests.slice(0, 8).map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className="block"
                    onClick={() =>
                      router.push(`/partner/dashboard/${request.id}`)
                    }
                  >
                    <PartnerRequestQueueItem>
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {request.organizationName || request.organizationId}
                          </p>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                              request.requiredDocsPending > 0
                                ? "border-cyan-300/40 bg-cyan-100 text-cyan-800"
                                : "border-emerald-300/40 bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {request.requiredDocsPending > 0
                              ? "Needs Docs"
                              : "Ready"}
                          </span>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                          <p className="text-xs text-slate-600">
                            Stream:{" "}
                            {getStreamDisplayName(request.packageStream)}
                          </p>
                          <p className="mt-1 text-xs text-slate-700">
                            {request.requiredDocsPending > 0
                              ? `Waiting on customer docs (${request.requiredDocsPending}/${request.requiredDocsTotal} outstanding)`
                              : "All required docs submitted - ready for execution"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">
                            Accepted:{" "}
                            {request.acknowledgedAt
                              ? new Date(
                                  request.acknowledgedAt,
                                ).toLocaleString()
                              : "-"}
                          </p>
                          <p className="text-[11px] font-medium text-cyan-700/90">
                            Open details page
                          </p>
                        </div>
                      </div>
                    </PartnerRequestQueueItem>
                  </button>
                ))}
                {acceptedRequests.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No accepted requests yet.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        ) : (
          <LogisticsWorkOrdersCtaCard
            description={`Go to Work Orders to move inbound logistics handoffs through ${WORKFLOW_ACTION_LABELS.logisticsConfirmHandoff}, ${WORKFLOW_ACTION_LABELS.logisticsActivate}, and ${WORKFLOW_ACTION_LABELS.logisticsDeliver}.`}
          >
            {(() => {
              const logisticsCtaLabel =
                logisticsWorkOrders.inProgress > 0
                  ? WORKFLOW_ACTION_LABELS.logisticsDeliver
                  : logisticsWorkOrders.accepted > 0
                    ? WORKFLOW_ACTION_LABELS.logisticsActivate
                    : logisticsWorkOrders.pendingAcceptance > 0
                      ? "Review Handoffs"
                      : "Open Work Orders";

              return (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    You have {logisticsWorkOrders.total} tracked handoff
                    {logisticsWorkOrders.total === 1 ? "" : "s"}.
                  </p>
                  <Button onClick={() => router.push("/partner/work-orders")}>
                    {logisticsCtaLabel}
                  </Button>
                </div>
              );
            })()}
          </LogisticsWorkOrdersCtaCard>
        )}

        <DualDocumentUploadModal
          open={Boolean(activeUploadHandoff)}
          title={WORKFLOW_ACTION_LABELS.logisticsDeliver}
          description={`${activeUploadHandoff?.poReference ?? "This handoff"} requires both documents before completion.`}
          firstLabel="Shipping Label"
          firstFileName={shippingLabelFile?.name ?? null}
          onSelectFirst={setShippingLabelFile}
          secondLabel="Proof Of Delivery"
          secondFileName={proofOfDeliveryFile?.name ?? null}
          onSelectSecond={setProofOfDeliveryFile}
          error={uploadModalError}
          busy={isUploadCompleting}
          onClose={() => setActiveUploadHandoff(null)}
          onConfirm={() => void uploadDocsAndCompleteHandoff()}
          confirmLabel="Upload And Complete"
          busyLabel="Uploading & Completing..."
        />
      </div>
    </>
  );
}

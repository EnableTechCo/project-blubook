"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToPartnerWorkOrders } from "@/services/workflow-realtime.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import { uploadDocument } from "@/services/documents.service";
import {
  WorkflowProgress,
  getWorkflowStageIndexFromSalesOrder,
} from "@/components/ui/workflow-progress";
import { SALES_WORKFLOW_STATES } from "@/constants/sales-workflow-states";
import { WORKFLOW_ACTION_LABELS } from "@/constants/workflow-stage-labels";
import { getStreamDisplayName } from "@/constants/stream-display";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
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
    }>;
  };
};

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
  const [poConfirmError, setPoConfirmError] = useState<string | null>(null);
  const [poReviewError, setPoReviewError] = useState<string | null>(null);
  const [poReviewReasonByRequirement, setPoReviewReasonByRequirement] =
    useState<Record<string, string>>({});
  const [processingPoReviewRequirementId, setProcessingPoReviewRequirementId] =
    useState<string | null>(null);
  const [processingHandoffId, setProcessingHandoffId] = useState<string | null>(
    null,
  );
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
  }, []);

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
    action: "accept" | "start" | "complete",
  ) {
    setProcessingHandoffId(handoffId);
    setHandoffConfirmError(null);

    const response = await fetch("/api/partner/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerHandoffId: handoffId,
        action,
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setHandoffConfirmError(body?.error ?? "Could not confirm handoff.");
      setProcessingHandoffId(null);
      return;
    }

    setProcessingHandoffId(null);
    void fetchDashboard();
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

  function getPurchaseOrderProgressLabel(orderStatus: string | null) {
    const normalizedStatus = (orderStatus ?? "").toLowerCase();

    if (normalizedStatus.includes("delivered")) {
      return "Delivery completed";
    }

    if (normalizedStatus.includes("purchase order received")) {
      return "Awaiting manual sales validation";
    }

    if (normalizedStatus.includes("order validated")) {
      return "Sales validation completed";
    }

    if (normalizedStatus.includes("inventory reserved")) {
      return "Inventory reserved, awaiting logistics handoff";
    }

    if (normalizedStatus.includes("logistics handoff created")) {
      return "Waiting for logistics acceptance";
    }

    if (normalizedStatus.includes("invoice generated")) {
      return "Invoice generated, awaiting shipment creation";
    }

    if (normalizedStatus.includes("shipment created")) {
      return "Shipment created, logistics execution in progress";
    }

    return "Order confirmed and progressing";
  }

  function getLogisticsWorkOrderHeading(input: {
    pendingAcceptance: number;
    accepted: number;
    inProgress: number;
    completed: number;
  }) {
    if (input.pendingAcceptance > 0) {
      return "Logistics Handoff Awaiting Action";
    }

    if (input.accepted > 0) {
      return "Logistics Handoffs Ready To Start";
    }

    if (input.inProgress > 0) {
      return "Logistics Work Orders In Progress";
    }

    if (input.completed > 0) {
      return "Recently Completed Logistics Work Orders";
    }

    return "Logistics Work Orders";
  }

  function hasTimelineStep(timeline: Array<{ step?: string }>, step: string) {
    return timeline.some((entry) => entry.step === step);
  }

  function buildWorkflowStepSnapshot(input: {
    orderStatus: string;
    orderTimeline: Array<{ step?: string }>;
  }) {
    const stageIndex = getWorkflowStageIndexFromSalesOrder({
      status: input.orderStatus,
      timeline: input.orderTimeline,
    });

    const clampedIndex = Math.max(
      0,
      Math.min(stageIndex, SALES_WORKFLOW_STATES.length - 1),
    );
    const currentStep = SALES_WORKFLOW_STATES[clampedIndex] ?? null;
    const lastStep =
      clampedIndex > 0 ? SALES_WORKFLOW_STATES[clampedIndex - 1] : null;
    const nextStep =
      clampedIndex < SALES_WORKFLOW_STATES.length - 1
        ? SALES_WORKFLOW_STATES[clampedIndex + 1]
        : null;
    const successfulSteps = SALES_WORKFLOW_STATES.slice(0, clampedIndex);
    const pendingSteps = SALES_WORKFLOW_STATES.slice(clampedIndex + 1);

    return {
      stageIndex,
      currentStep,
      lastStep,
      nextStep,
      successfulCount: successfulSteps.length,
      pendingCount: pendingSteps.length,
      successfulSteps,
      pendingSteps,
    };
  }

  const summary = payload?.summary ?? {
    total: 0,
    sent: 0,
    acknowledged: 0,
    failed: 0,
    pendingCustomerDocs: 0,
    readyForExecution: 0,
  };

  const requests = payload?.requests ?? [];
  const newPings = requests.filter(
    (request) => request.requestStatus === "sent",
  );
  const acceptedRequests = requests.filter(
    (request) => request.requestStatus === "acknowledged",
  );
  const purchaseOrders = payload?.purchaseOrders ?? {
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
  };
  const logisticsWorkOrders = payload?.logisticsWorkOrders ?? {
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
    }>,
  };
  const isLogisticsPartner =
    payload?.partner.isLogistics ??
    (payload?.partner.offeredServiceStream ?? "")
      .toLowerCase()
      .includes("logistics");

  useEffect(() => {
    if (!payload) {
      return;
    }

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
  }, [isLogisticsPartner, logisticsWorkOrders, payload]);

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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold text-white">
              Partner Dashboard
            </h2>
            <p className="mt-2 text-sm text-slate-200/85">
              {isLogisticsPartner
                ? "Inbound logistics handoffs, execution progress, and completion tracking."
                : "Ping-first request operations for partner decisioning and customer-doc readiness."}
            </p>
          </div>
          <Badge>
            {isLogisticsPartner
              ? `${logisticsWorkOrders.total} Total Work Orders`
              : `${summary.total} Total Requests`}
          </Badge>
        </div>

        {!isLogisticsPartner && purchaseOrders.active > 0 ? (
          <section className="rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-4">
            <p className="text-sm font-semibold text-amber-100">
              {purchaseOrders.pendingAction > 0
                ? "Purchase Order Received • Confirmation Required"
                : "Purchase Order Received"}
            </p>
            <p className="mt-1 text-xs text-amber-50/90">
              {purchaseOrders.pendingAction > 0
                ? `${purchaseOrders.pendingAction} purchase order${purchaseOrders.pendingAction === 1 ? "" : "s"} awaiting your confirmation.`
                : `${purchaseOrders.active} active purchase order${purchaseOrders.active === 1 ? "" : "s"} in progress.`}
            </p>
            {poConfirmError ? (
              <p className="mt-1 text-xs text-red-300">{poConfirmError}</p>
            ) : null}
            {poReviewError ? (
              <p className="mt-1 text-xs text-red-300">{poReviewError}</p>
            ) : null}

            <div className="mt-4 space-y-4">
              {purchaseOrders.recent.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
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

                    const poRequirement = item.purchaseOrderRequirement ?? null;
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
                    const canRollbackValidation = status === "Order Validated";
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

                    type SalesControlStepState = "done" | "active" | "upcoming";

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

                    const stepClassByState: Record<
                      SalesControlStepState,
                      string
                    > = {
                      done: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
                      active:
                        "border-cyan-300/40 bg-cyan-400/20 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]",
                      upcoming:
                        "border-white/10 bg-slate-900/60 text-slate-400",
                    };

                    return (
                      <>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-white">
                              {item.poReference}
                            </p>
                            {item.organizationName ? (
                              <p className="text-[11px] text-slate-400">
                                {item.organizationName}
                              </p>
                            ) : null}
                          </div>
                          {showConfirmButton ? (
                            <div className="flex flex-col items-end gap-1">
                              <Button
                                className={`h-8 rounded-md px-3 text-xs font-semibold ${
                                  confirmLockedByPoReview
                                    ? "bg-slate-700/80 text-slate-300 hover:bg-slate-700/80"
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
                                <p className="text-[11px] text-amber-200">
                                  Review decision required first (Approve PO or
                                  Request Resubmission).
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-right">
                              <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] text-emerald-200">
                                Confirmed
                              </span>
                              <p className="mt-1 text-[11px] text-cyan-200/90">
                                {getPurchaseOrderProgressLabel(
                                  item.orderStatus,
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                        {poRequirement ? (
                          <div className="mb-3 rounded-md border border-white/10 bg-slate-900/50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                              Purchase Order Document Review
                            </p>
                            <p className="mt-1 text-[11px] text-slate-300">
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
                                    className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-2 py-1"
                                  >
                                    <div>
                                      <p className="text-[11px] text-white">
                                        {file.fileName}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
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
                                        className="text-[11px] font-semibold text-cyan-200 underline underline-offset-2"
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
                              <p className="mt-2 text-[11px] text-amber-200">
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
                                  className="w-full rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white placeholder:text-slate-400"
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    className="h-7 rounded-md bg-emerald-500/90 px-2.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
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
                                    className="h-7 rounded-md border border-red-400/30 px-2.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/10"
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
                              <p className="mt-2 text-[11px] text-emerald-300">
                                PO document approved. Sales validation can
                                continue.
                              </p>
                            )}
                          </div>
                        ) : null}
                        <div className="mb-3 grid gap-2 sm:grid-cols-3">
                          <div
                            className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${stepClassByState[validateState]}`}
                          >
                            {validateState === "done"
                              ? "Validate Done"
                              : "Validate Order"}
                          </div>
                          <div
                            className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${stepClassByState[reserveState]}`}
                          >
                            {reserveState === "done"
                              ? "Reserved"
                              : "Reserve Inventory"}
                          </div>
                          <div
                            className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${stepClassByState[handoffState]}`}
                          >
                            {handoffState === "done"
                              ? "Handoff Created"
                              : "Create Handoff"}
                          </div>
                        </div>

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
                            <p className="text-[11px] text-amber-200">
                              Validate Order is locked until the uploaded PO
                              document is approved.
                            </p>
                          ) : null}

                          {hasHandoffCreated ? (
                            <p className="mt-1 text-[11px] text-slate-300/85">
                              Backward navigation is disabled after handoff
                              creation.
                            </p>
                          ) : null}
                        </div>
                        <p className="mb-3 text-[11px] text-slate-300/90">
                          Sales control points advance in strict sequence. Only
                          the current required step is actionable.
                        </p>
                      </>
                    );
                  })()}
                  <WorkflowProgress
                    variant="sales"
                    compact={false}
                    currentIndex={getWorkflowStageIndexFromSalesOrder({
                      status: item.orderStatus ?? "",
                      timeline: item.orderTimeline,
                    })}
                  />
                </div>
              ))}

              {(purchaseOrders.additionalRecent ?? []).length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    Other Active Purchase Orders
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(purchaseOrders.additionalRecent ?? []).map((item) => (
                      <span
                        key={`po-additional-${item.id}`}
                        className="rounded-full border border-white/10 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200"
                      >
                        {item.poReference}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {isLogisticsPartner ? (
          <section className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-4">
            <p className="text-sm font-semibold text-cyan-100">
              {getLogisticsWorkOrderHeading(logisticsWorkOrders)}
            </p>
            <p className="mt-1 text-xs text-cyan-50/90">
              {logisticsWorkOrders.pendingAcceptance > 0
                ? `${logisticsWorkOrders.pendingAcceptance} handoff${logisticsWorkOrders.pendingAcceptance === 1 ? "" : "s"} waiting acceptance.`
                : logisticsWorkOrders.accepted > 0
                  ? `${logisticsWorkOrders.accepted} handoff${logisticsWorkOrders.accepted === 1 ? "" : "s"} confirmed and ready to start.`
                  : `${logisticsWorkOrders.inProgress} handoff${logisticsWorkOrders.inProgress === 1 ? "" : "s"} currently in progress.`}
            </p>
            {handoffConfirmError ? (
              <p className="mt-1 text-xs text-red-300">{handoffConfirmError}</p>
            ) : null}

            <div className="mt-4 space-y-4">
              {logisticsWorkOrders.recent.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-200">
                    No active logistics handoffs right now. New inbound handoffs
                    from sales will appear here.
                  </p>
                </div>
              ) : null}
              {logisticsWorkOrders.recent.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  {(() => {
                    type LogisticsControlStepState =
                      | "done"
                      | "active"
                      | "upcoming";

                    const canAccept = item.status === "pending";
                    const canStart = item.status === "accepted";
                    const canComplete = item.status === "in_progress";

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

                    const stepClassByState: Record<
                      LogisticsControlStepState,
                      string
                    > = {
                      done: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
                      active:
                        "border-cyan-300/40 bg-cyan-400/20 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]",
                      upcoming:
                        "border-white/10 bg-slate-900/60 text-slate-400",
                    };

                    return (
                      <>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-white">
                              {item.poReference}
                            </p>
                            {item.organizationName ? (
                              <p className="text-[11px] text-slate-400">
                                {item.organizationName}
                              </p>
                            ) : null}
                          </div>
                          {item.status === "completed" ? (
                            <Button
                              className="h-8 rounded-md bg-slate-500/90 px-3 text-xs font-semibold text-white hover:bg-slate-400"
                              onClick={() =>
                                router.push("/partner/work-orders")
                              }
                            >
                              View Details
                            </Button>
                          ) : (
                            <div className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] text-emerald-200">
                              In Progress
                            </div>
                          )}
                        </div>

                        <div className="mb-3 grid gap-2 sm:grid-cols-3">
                          <div
                            className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${stepClassByState[acceptState]}`}
                          >
                            {acceptState === "done"
                              ? "Handoff Confirmed"
                              : "Accept Handoff"}
                          </div>
                          <div
                            className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${stepClassByState[startState]}`}
                          >
                            {startState === "done"
                              ? "Logistics Active"
                              : WORKFLOW_ACTION_LABELS.logisticsActivate}
                          </div>
                          <div
                            className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${stepClassByState[completeState]}`}
                          >
                            {completeState === "done"
                              ? "Delivered"
                              : WORKFLOW_ACTION_LABELS.logisticsDeliver}
                          </div>
                        </div>

                        <WorkflowStepActions
                          actions={[
                            ...(canAccept
                              ? [
                                  {
                                    key: `${item.id}:accept`,
                                    label: "Proceed: Accept Handoff",
                                    loading: processingHandoffId === item.id,
                                    onClick: () =>
                                      void updateLogisticsHandoffStatus(
                                        item.id,
                                        "accept",
                                      ),
                                    disabled: processingHandoffId === item.id,
                                  },
                                ]
                              : []),
                            ...(canStart
                              ? [
                                  {
                                    key: `${item.id}:start`,
                                    label: "Proceed: Start Work",
                                    loading: processingHandoffId === item.id,
                                    onClick: () =>
                                      void updateLogisticsHandoffStatus(
                                        item.id,
                                        "start",
                                      ),
                                    disabled: processingHandoffId === item.id,
                                  },
                                ]
                              : []),
                            ...(canComplete
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
                                    disabled: processingHandoffId === item.id,
                                  },
                                ]
                              : []),
                          ]}
                        />

                        <p className="mb-3 text-[11px] text-slate-300/90">
                          Logistics handoff advances in strict sequence. Only
                          the current required step is actionable.
                        </p>
                      </>
                    );
                  })()}
                  <WorkflowProgress
                    variant="sales"
                    compact={false}
                    currentIndex={getWorkflowStageIndexFromSalesOrder({
                      status: item.orderStatus ?? "",
                      timeline: item.orderTimeline,
                    })}
                  />
                </div>
              ))}

              {(logisticsWorkOrders.additionalRecent ?? []).length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    Other Active Logistics Handoffs
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(logisticsWorkOrders.additionalRecent ?? []).map(
                      (item) => (
                        <span
                          key={`handoff-additional-${item.id}`}
                          className="rounded-full border border-white/10 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200"
                        >
                          {item.poReference}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {isLogisticsPartner ? (
            <>
              <Card
                title="Pending Acceptance"
                description="Inbound handoffs waiting for logistics acceptance."
              >
                <p className="text-3xl font-semibold text-amber-200">
                  {logisticsWorkOrders.pendingAcceptance}
                </p>
              </Card>
              <Card
                title="Accepted"
                description="Handoffs accepted and ready to begin."
              >
                <p className="text-3xl font-semibold text-cyan-200">
                  {logisticsWorkOrders.accepted}
                </p>
              </Card>
              <Card
                title="In Progress"
                description="Active logistics fulfillment in execution."
              >
                <p className="text-3xl font-semibold text-white">
                  {logisticsWorkOrders.inProgress}
                </p>
              </Card>
              <Card
                title="Completed"
                description="Work orders completed by logistics."
              >
                <p className="text-3xl font-semibold text-emerald-300">
                  {logisticsWorkOrders.completed}
                </p>
              </Card>
              <Card
                title="Rejected"
                description="Handoffs rejected by logistics."
              >
                <p className="text-3xl font-semibold text-red-300">
                  {logisticsWorkOrders.rejected}
                </p>
              </Card>
            </>
          ) : (
            <>
              <Card
                title="New Pings"
                description="Needs accept/reject before execution."
              >
                <p className="text-3xl font-semibold text-white">
                  {summary.sent}
                </p>
              </Card>
              <Card title="Accepted" description="Acknowledged requests">
                <p className="text-3xl font-semibold text-white">
                  {summary.acknowledged}
                </p>
              </Card>
              <Card
                title="Rejected"
                description="Requests rejected by partner."
              >
                <p className="text-3xl font-semibold text-amber-300">
                  {summary.failed}
                </p>
              </Card>
              <Card title="Pending Docs" description="Accepted pending docs">
                <p className="text-3xl font-semibold text-cyan-200">
                  {summary.pendingCustomerDocs}
                </p>
              </Card>
              <Card
                title="Ready"
                description="Accepted with required all docs."
              >
                <p className="text-3xl font-semibold text-emerald-300">
                  {summary.readyForExecution}
                </p>
              </Card>
            </>
          )}
        </div>

        {!isLogisticsPartner ? (
          <div className="grid gap-4">
            <Card
              title="Incoming Sales Requests"
              description="Accept or reject incoming sales-order requests."
            >
              <div className="space-y-2.5">
                {newPings.length > 0 ? (
                  <div className="grid gap-x-2 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                    {newPings.slice(0, 8).map((request) => (
                      <div
                        key={request.id}
                        className="group relative flex min-h-[175px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-transparent px-4 py-4"
                      >
                        <div className="relative flex h-full flex-col">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.18)]" />
                              <p className="truncate text-sm font-semibold text-white">
                                {request.organizationName ||
                                  request.organizationId}
                              </p>
                            </div>

                            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                              <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-cyan-100">
                                #{request.id.slice(0, 8)}
                              </span>
                              <span className="rounded bg-white/8 px-2 py-0.5">
                                Tier:{" "}
                                {request.packageTierName ||
                                  request.packageTierCode ||
                                  request.packageId ||
                                  "Unknown"}
                              </span>
                              <span className="rounded bg-white/8 px-2 py-0.5">
                                {getStreamDisplayName(request.packageStream)}
                              </span>
                              <span className="rounded bg-amber-300/12 px-2 py-0.5 text-amber-100">
                                Docs: {request.requiredDocsPending}/
                                {request.requiredDocsTotal}
                              </span>
                            </div>

                            {request.aiReadiness.status !==
                            "insufficient_signal" ? (
                              <>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                  <span
                                    className={`rounded px-2 py-0.5 ${
                                      request.aiReadiness.status === "high"
                                        ? "bg-emerald-400/15 text-emerald-200"
                                        : request.aiReadiness.status ===
                                            "medium"
                                          ? "bg-cyan-300/12 text-cyan-100"
                                          : "bg-amber-300/15 text-amber-200"
                                    }`}
                                  >
                                    Readiness: {request.aiReadiness.label}
                                  </span>
                                  {request.aiReadiness.score !== null ? (
                                    <span className="rounded bg-cyan-300/12 px-2 py-0.5 text-cyan-100">
                                      Score {request.aiReadiness.score}
                                    </span>
                                  ) : null}
                                  {request.aiReadiness.confidence !== null ? (
                                    <span className="rounded bg-white/8 px-2 py-0.5 text-slate-300">
                                      Confidence{" "}
                                      {Math.round(
                                        request.aiReadiness.confidence,
                                      )}
                                      %
                                    </span>
                                  ) : null}
                                </div>

                                {request.aiReadiness.reasons[0] ? (
                                  <p className="mt-1.5 text-[11px] text-slate-300">
                                    {request.aiReadiness.reasons[0]}
                                  </p>
                                ) : null}
                              </>
                            ) : null}

                            <p className="mt-2.5 font-mono text-[10px] text-slate-400">
                              Timestamp:{" "}
                              {new Date(request.sentAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="mt-5 flex items-center justify-start gap-2">
                            <Button
                              className="h-8 rounded-md bg-emerald-500/90 px-3 text-xs text-slate-950 hover:bg-emerald-400"
                              disabled={processingRequestId === request.id}
                              onClick={() =>
                                void submitDecision(request.id, "accept")
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              variant="danger"
                              className="h-8 rounded-md px-3 text-xs"
                              disabled={processingRequestId === request.id}
                              onClick={() =>
                                void submitDecision(request.id, "reject")
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {newPings.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    No new request pings.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card
              title="Sales Orders Queue"
              description="Accepted sales-order requests and operational status."
            >
              <div className="space-y-3">
                {acceptedRequests.slice(0, 8).map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className="w-full rounded-2xl border border-white/15 bg-transparent p-3 text-left transition hover:border-cyan-200/40"
                    onClick={() =>
                      router.push(`/partner/dashboard/${request.id}`)
                    }
                  >
                    <p className="text-sm font-semibold text-white">
                      {request.organizationName || request.organizationId}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Stream: {getStreamDisplayName(request.packageStream)}
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {request.requiredDocsPending > 0
                        ? `Waiting on customer docs (${request.requiredDocsPending}/${request.requiredDocsTotal} outstanding)`
                        : "All required docs submitted - ready for execution"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Accepted:{" "}
                      {request.acknowledgedAt
                        ? new Date(request.acknowledgedAt).toLocaleString()
                        : "-"}
                    </p>
                    <p className="mt-1 text-[11px] text-cyan-200/80">
                      Open details page
                    </p>
                  </button>
                ))}
                {acceptedRequests.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    No accepted requests yet.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        ) : (
          <Card
            title="Logistics Work Orders"
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
                  <p className="text-sm text-slate-300">
                    You have {logisticsWorkOrders.total} tracked handoff
                    {logisticsWorkOrders.total === 1 ? "" : "s"}.
                  </p>
                  <Button onClick={() => router.push("/partner/work-orders")}>
                    {logisticsCtaLabel}
                  </Button>
                </div>
              );
            })()}
          </Card>
        )}

        {activeUploadHandoff ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Upload logistics documents"
            onClick={() => {
              if (!isUploadCompleting) {
                setActiveUploadHandoff(null);
              }
            }}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-cyan-300/30 bg-slate-950 p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-lg font-semibold text-white">
                {WORKFLOW_ACTION_LABELS.logisticsDeliver}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {activeUploadHandoff.poReference} requires both documents before
                completion.
              </p>

              <div className="mt-4 grid gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                    Shipping Label
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Upload PDF or image.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <FileUploader
                      buttonLabel={
                        shippingLabelFile ? "Replace File" : "Upload File"
                      }
                      onFilesSelected={(files) => {
                        setShippingLabelFile(files[0] ?? null);
                      }}
                      accept="application/pdf,image/*"
                      disabled={isUploadCompleting}
                      variant="ghost"
                      className="h-8 border border-white/20 bg-white/5 px-3 text-xs"
                    />
                    <p className="text-xs text-slate-300">
                      {shippingLabelFile?.name ?? "No file selected"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                    Proof Of Delivery
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Upload PDF or image.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <FileUploader
                      buttonLabel={
                        proofOfDeliveryFile ? "Replace File" : "Upload File"
                      }
                      onFilesSelected={(files) => {
                        setProofOfDeliveryFile(files[0] ?? null);
                      }}
                      accept="application/pdf,image/*"
                      disabled={isUploadCompleting}
                      variant="ghost"
                      className="h-8 border border-white/20 bg-white/5 px-3 text-xs"
                    />
                    <p className="text-xs text-slate-300">
                      {proofOfDeliveryFile?.name ?? "No file selected"}
                    </p>
                  </div>
                </div>
              </div>

              {uploadModalError ? (
                <p className="mt-3 text-xs text-red-300">{uploadModalError}</p>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  disabled={isUploadCompleting}
                  onClick={() => setActiveUploadHandoff(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-8 rounded-md bg-cyan-400/90 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                  disabled={isUploadCompleting}
                  onClick={() => void uploadDocsAndCompleteHandoff()}
                >
                  {isUploadCompleting
                    ? "Uploading & Completing..."
                    : "Upload And Complete"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

import { getWorkflowStageIndexFromSalesOrder } from "@/components/ui/workflow-progress";
import { SALES_WORKFLOW_STATES } from "@/constants/sales-workflow-states";

export function hasTimelineStep(
  timeline: Array<{ step?: string }>,
  step: string,
) {
  return timeline.some((entry) => entry.step === step);
}

export function getPurchaseOrderProgressLabel(orderStatus: string | null) {
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

export function getLogisticsWorkOrderHeading(input: {
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

export function buildWorkflowStepSnapshot(input: {
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

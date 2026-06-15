"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { LOGISTICS_WORKFLOW_STATES } from "@/constants/logistics-workflow-states";
import { SALES_WORKFLOW_STATES } from "@/constants/sales-workflow-states";
import {
  SALES_WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGE_LABELS,
  type WorkflowStageKey,
  type SalesWorkflowStageKey,
} from "@/constants/workflow-stage-labels";
import { cn } from "@/lib/utils";
import {
  getWorkflowStepsForAudience,
  type WorkflowAudienceRole,
} from "@/lib/workflow/workflow-step-contract";

const SALES_WORKFLOW_STAGE_ORDER: SalesWorkflowStageKey[] = [
  "po_submitted",
  "sales_validated",
  "inventory_reserved",
  "handoff_created",
  "handoff_confirmed",
  "system_updated",
  "delivered",
];

const WORKFLOW_STAGE_ORDER: WorkflowStageKey[] = [
  "po_submitted",
  "sales_validated",
  "inventory_reserved",
  "handoff_created",
  "handoff_confirmed",
  "logistics_active",
  "in_transit",
  "order_arrived",
  "pod_signed",
  "system_updated",
  "delivered",
];

const WORKFLOW_STAGE_ICONS: Record<WorkflowStageKey, LucideIcon> = {
  po_submitted: MapPin,
  sales_validated: MapPin,
  inventory_reserved: MapPin,
  handoff_created: MapPin,
  handoff_confirmed: MapPin,
  logistics_active: MapPin,
  in_transit: MapPin,
  order_arrived: MapPin,
  pod_signed: MapPin,
  system_updated: MapPin,
  delivered: MapPin,
};

const SALES_WORKFLOW_STAGE_ICONS: Record<SalesWorkflowStageKey, LucideIcon> =
  WORKFLOW_STAGE_ICONS;

/**
 * Maps each workflow step_key (from order_workflow_step_events) to the
 * stage index it advances the tracker to. Index represents the NEXT active
 * stage after the step is complete — i.e. the step's CURRENT position
 * shifts rightward by one when recorded.
 *
 * Both SALES_WORKFLOW_STAGE_ORDER and WORKFLOW_STAGE_ORDER share the same
 * index positions, so this mapping covers both variants.
 */
const STEP_KEY_TO_STAGE_INDEX: Readonly<Record<string, number>> = {
  purchase_order_received: 1, // po_submitted → done; sales_validated is current
  sales_validated: 2, // alias seen in historical timeline events
  order_validated: 2, // → inventory_reserved is current
  inventory_reserved: 3, // → handoff_created is current
  logistics_handoff_created: 4, // → handoff_confirmed is current
  logistics_handoff_accepted: 5, // alias for handoff confirmed transition
  invoice_generated: 4, // sales financial checkpoint — same stage
  shipment_created: 5, // → logistics_active is current
  order_received: 5,
  order_transmitted_to_warehouse: 5,
  notify_customer: 5,
  pack_items_for_shipment: 5,
  logistics_fulfillment_started: 5,
  generate_shipping_label_documentation: 5,
  track_shipment_in_transit: 6, // → in_transit is current
  shipment_in_transit: 6,
  reroute_delivery: 6,
  order_arrives_at_destination: 7, // → order_arrived is current
  customer_receives_signs_pod: 8, // → pod_signed is current
  blubook_system_updated: 9, // → system_updated is current
  order_delivered: 10, // → delivered
  logistics_order_delivered: 10,
  delivered: 10,
};

export function normalizeWorkflowCompletedStepKeys(keys: string[]): string[] {
  const normalized = new Set(keys);

  // Timeline/events historically use these aliases; map them to canonical
  // workflow contract keys so matrix/checkpoint completion stays accurate.
  if (normalized.has("logistics_handoff_accepted")) {
    normalized.add("order_received");
  }

  if (normalized.has("logistics_fulfillment_started")) {
    normalized.add("order_transmitted_to_warehouse");
  }

  if (normalized.has("shipment_in_transit")) {
    normalized.add("track_shipment_in_transit");
  }

  if (normalized.has("logistics_order_delivered")) {
    normalized.add("customer_receives_signs_pod");
  }

  return Array.from(normalized);
}

/**
 * Derives the WorkflowProgress stage index purely from recorded step events.
 * Returns the highest index implied by the completed step keys, defaulting to 0.
 */
export function deriveStageIndexFromStepKeys(
  completedStepKeys: string[],
): number {
  let max = 0;
  for (const key of completedStepKeys) {
    const idx = STEP_KEY_TO_STAGE_INDEX[key];
    if (idx !== undefined && idx > max) {
      max = idx;
    }
  }
  return max;
}

export type WorkflowAudience = "customer" | "sales" | "logistics";

function normalizeStatus(value: string) {
  return value.trim().toLowerCase();
}

function hasTimelineStep(
  timeline: Array<{ step?: string }> | undefined,
  step: string,
) {
  return (timeline ?? []).some((entry) => entry.step === step);
}

function hasSalesValidatedTimelineStep(
  timeline: Array<{ step?: string }> | undefined,
) {
  return (
    hasTimelineStep(timeline, "order_validated") ||
    hasTimelineStep(timeline, "sales_validated")
  );
}

function statusIncludesAny(status: string, values: string[]) {
  return values.some((value) => status.includes(value));
}

function isLogisticsOrderReceivedStatus(status: string) {
  return status === "order received";
}

function getSalesWorkflowCurrentState(input: {
  status: string;
  timeline?: Array<{ step?: string }>;
}) {
  const status = normalizeStatus(input.status);

  // Once handed to logistics, sales pipeline is complete at Invoice Generated.
  // All post-invoice states are logistics-owned.
  if (
    status.includes("delivered") ||
    status.includes("track shipment in transit") ||
    status.includes("shipment in transit") ||
    status.includes("reroute delivery") ||
    status.includes("order arrives at destination") ||
    status.includes("customer receives") ||
    status.includes("signs pod") ||
    status.includes("blubook system updated") ||
    isLogisticsOrderReceivedStatus(status) ||
    status.includes("order transmitted") ||
    status.includes("notify customer") ||
    status.includes("pack items") ||
    status.includes("generate shipping label") ||
    hasTimelineStep(input.timeline, "order_delivered") ||
    hasTimelineStep(input.timeline, "logistics_order_delivered") ||
    hasTimelineStep(input.timeline, "shipment_in_transit")
  ) {
    return "Invoice Generated";
  }

  if (status.includes("invoice generated")) {
    return "Invoice Generated";
  }

  if (status.includes("packaging")) {
    return "Packaging";
  }

  if (status.includes("manufacturing")) {
    return "Manufacturing";
  }

  if (status.includes("pick ticket generated")) {
    return "Pick Ticket Generated";
  }

  if (status.includes("work order created")) {
    return "Work Order Created";
  }

  if (
    status.includes("logistics fulfillment in progress") ||
    hasTimelineStep(input.timeline, "logistics_fulfillment_started")
  ) {
    return "Logistics Fulfillment In Progress";
  }

  if (
    statusIncludesAny(status, [
      "logistics handoff created",
      "service provider confirmed order",
      "logistics handoff accepted",
    ]) ||
    isLogisticsOrderReceivedStatus(status) ||
    hasTimelineStep(input.timeline, "logistics_handoff_created") ||
    hasTimelineStep(input.timeline, "logistics_handoff_accepted")
  ) {
    return "Logistics Handoff Created";
  }

  if (status.includes("inventory reserved")) {
    return "Inventory Reserved";
  }

  if (
    status.includes("order validated") ||
    hasSalesValidatedTimelineStep(input.timeline)
  ) {
    return "Order Validated";
  }

  return "Purchase Order Received";
}

function getLogisticsWorkflowCurrentState(input: {
  status: string;
  timeline?: Array<{ step?: string }>;
}) {
  const status = normalizeStatus(input.status);

  if (
    status.includes("delivered") ||
    hasTimelineStep(input.timeline, "order_delivered") ||
    hasTimelineStep(input.timeline, "logistics_order_delivered")
  ) {
    return "Delivered";
  }

  if (status.includes("blubook system updated")) {
    return "BluBook System Updated";
  }

  if (status.includes("customer receives") || status.includes("signs pod")) {
    return "Customer Receives & Signs POD";
  }

  if (status.includes("order arrives at destination")) {
    return "Order Arrives at Destination";
  }

  if (status.includes("reroute delivery")) {
    return "Reroute Delivery";
  }

  if (
    statusIncludesAny(status, [
      "track shipment in transit",
      "shipment in transit",
    ]) ||
    hasTimelineStep(input.timeline, "shipment_in_transit")
  ) {
    return "Track Shipment In Transit";
  }

  if (
    status.includes("generate shipping label") ||
    status.includes("shipping label & documentation")
  ) {
    return "Generate Shipping Label & Documentation";
  }

  if (
    status.includes("pack items for shipment") ||
    status.includes("logistics fulfillment in progress") ||
    hasTimelineStep(input.timeline, "logistics_fulfillment_started")
  ) {
    return "Pack Items for Shipment";
  }

  if (status.includes("notify customer")) {
    return "Notify Customer";
  }

  if (status.includes("order transmitted to warehouse")) {
    return "Order Transmitted to Warehouse";
  }

  if (
    statusIncludesAny(status, [
      "service provider confirmed order",
      "logistics handoff accepted",
    ]) ||
    isLogisticsOrderReceivedStatus(status) ||
    hasTimelineStep(input.timeline, "logistics_handoff_accepted")
  ) {
    return "Order Received";
  }

  if (
    status.includes("logistics handoff created") ||
    hasTimelineStep(input.timeline, "logistics_handoff_created")
  ) {
    return "Order Received";
  }

  return "Order Received";
}

export function getWorkflowStepMatrixIndexes(input: {
  status: string;
  timeline?: Array<{ step?: string }>;
}) {
  const salesState = getSalesWorkflowCurrentState(input);
  const logisticsState = getLogisticsWorkflowCurrentState(input);

  return {
    salesIndex: Math.max(0, SALES_WORKFLOW_STATES.indexOf(salesState)),
    logisticsIndex: Math.max(
      0,
      LOGISTICS_WORKFLOW_STATES.indexOf(logisticsState),
    ),
  };
}

// ─── Event-driven audience-filtered step row ────────────────────────────────

type StepRowItem = {
  key: string;
  label: string;
  owner: "sales" | "logistics";
  completed: boolean;
  /** The step is the first incomplete one in the visible list */
  current: boolean;
  action: string | null;
};

function getAudienceActionForStepKey(input: {
  audience: WorkflowAudienceRole;
  key: string;
  owner: "sales" | "logistics";
}): string | null {
  const actions: Record<string, string> = {
    // Sales-owned
    purchase_order_received: "Sales must explicitly acknowledge PO intake.",
    order_validated: "Sales validation is a business checkpoint.",
    inventory_reserved: "Sales/ops confirm reservation before handoff.",
    logistics_handoff_created:
      "Sales confirms handoff and assigned logistics partner.",
    invoice_generated: "Sales-controlled financial checkpoint.",
    shipment_created: "Sales ops confirms dispatch.",
    // Logistics-owned
    order_received:
      "Logistics acknowledges intake from sales to start fulfillment.",
    order_transmitted_to_warehouse:
      "Logistics transmits order to warehouse for picking.",
    notify_customer:
      "Logistics sends customer notification of incoming shipment.",
    pack_items_for_shipment: "Logistics confirms all items are packed.",
    generate_shipping_label_documentation:
      "Logistics uploads shipping label and compliance paperwork.",
    track_shipment_in_transit: "Logistics dispatched; tracking is active.",
    reroute_delivery: "Exception workflow — explicit operator action required.",
    order_arrives_at_destination:
      "Logistics confirms arrival at delivery destination.",
    customer_receives_signs_pod:
      "Logistics uploads POD to allow final delivery close-out (terminal step).",
  };

  const defaultAction = actions[input.key] ?? null;
  if (!defaultAction) return null;

  // Customer-specific overrides
  if (input.audience === "customer") {
    if (input.key === "purchase_order_received") {
      return "Your PO was uploaded and is waiting for sales validation.";
    }
    if (input.key === "invoice_generated") {
      return "Your invoice has been generated. Expect a billing notification.";
    }
    if (input.key === "notify_customer") {
      return "Logistics notified you about your incoming shipment.";
    }
    if (input.key === "track_shipment_in_transit") {
      return "Your shipment is on the way.";
    }
    if (input.key === "order_arrives_at_destination") {
      return "Your shipment has arrived at its destination.";
    }
    if (input.key === "customer_receives_signs_pod") {
      return "Please sign the Proof of Delivery to complete delivery.";
    }
    if (input.key === "shipment_created") {
      return "Your shipment has been created and is being prepared.";
    }
    return null;
  }

  // Sales watching logistics handoff boundary
  if (input.audience === "sales" && input.owner === "logistics") {
    if (input.key === "order_received") {
      return "Sales monitors handoff acceptance and exception alerts.";
    }
    return null;
  }

  // Logistics watching sales handoff boundary
  if (input.audience === "logistics" && input.owner === "sales") {
    if (input.key === "logistics_handoff_created") {
      return "Waiting for sales handoff package and assignment details.";
    }
    if (input.key === "shipment_created") {
      return defaultAction;
    }
    return null;
  }

  return defaultAction;
}

function WorkflowStepEventRow({
  title,
  items,
}: {
  title: string;
  items: StepRowItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(
              "min-w-[220px] flex-1 rounded-lg border px-3 py-2",
              item.completed
                ? "border-emerald-300/40 bg-emerald-500/10"
                : item.current
                  ? "border-cyan-300/40 bg-cyan-500/10"
                  : "border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-white/5",
            )}
          >
            <p
              className={cn(
                "text-xs font-medium",
                item.completed || item.current
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-700 dark:text-slate-300",
              )}
            >
              {item.label}
            </p>
            {item.action ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-cyan-700 font-medium">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{item.action}</span>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Event-driven, audience-filtered workflow step matrix.
 *
 * @param completedStepKeys  Array of step keys that have been explicitly recorded in
 *                           order_workflow_step_events. Completion state derives purely
 *                           from this list — NO status/timeline inference.
 * @param audience           Who is viewing this: customer | sales | logistics | staff.
 *                           Determines which steps are shown based on the visibleTo
 *                           field in WORKFLOW_STEP_CONTRACT.
 */
export function WorkflowStepMatrix({
  completedStepKeys,
  audience,
  title = "Workflow Steps",
  description,
}: {
  completedStepKeys: string[];
  audience: WorkflowAudienceRole;
  title?: string;
  description?: string;
}) {
  const completedSet = new Set(
    normalizeWorkflowCompletedStepKeys(completedStepKeys),
  );

  // Get steps visible to this audience, preserving contract order.
  const visibleSteps = getWorkflowStepsForAudience(audience);

  // Find the first incomplete step index across the visible set.
  const firstIncompleteKey =
    visibleSteps.find((s) => !completedSet.has(s.key))?.key ?? null;

  // Build row items grouped by owner.
  function buildItems(owner: "sales" | "logistics"): StepRowItem[] {
    return visibleSteps
      .filter((s) => s.owner === owner)
      .map((s) => ({
        key: s.key,
        label: s.label,
        owner: s.owner,
        completed: completedSet.has(s.key),
        current: s.key === firstIncompleteKey,
        action: getAudienceActionForStepKey({
          audience,
          key: s.key,
          owner: s.owner,
        }),
      }));
  }

  const salesItems = buildItems("sales");
  const logisticsItems = buildItems("logistics");

  const defaultDescription =
    audience === "customer"
      ? "Your order milestones."
      : audience === "sales"
        ? "Sales-owned steps and logistics handoff checkpoints."
        : audience === "logistics"
          ? "Logistics fulfillment steps and incoming handoff details."
          : "All workflow steps across sales and logistics.";

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            {description ?? defaultDescription}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-700 dark:border-cyan-300/30 dark:text-cyan-100">
          <MapPin className="h-3.5 w-3.5" />
          Interaction-verified
        </div>
      </div>

      <div className="space-y-4">
        {salesItems.length > 0 ? (
          <WorkflowStepEventRow title="Sales" items={salesItems} />
        ) : null}
        {logisticsItems.length > 0 ? (
          <WorkflowStepEventRow title="Logistics" items={logisticsItems} />
        ) : null}
      </div>
    </div>
  );
}

export function getWorkflowStageIndexFromOrder(input: {
  status: string;
  timeline?: Array<{ step?: string }>;
}) {
  const status = input.status.toLowerCase();
  const timelineSteps = new Set(
    (input.timeline ?? [])
      .map((item) => item.step)
      .filter((value): value is string => Boolean(value)),
  );

  if (
    status.includes("delivered") ||
    timelineSteps.has("logistics_order_delivered")
  ) {
    return 10;
  }

  if (status.includes("blubook system updated")) {
    return 9;
  }

  if (status.includes("customer receives") || status.includes("signs pod")) {
    return 8;
  }

  if (status.includes("order arrives at destination")) {
    return 7;
  }

  if (
    status.includes("track shipment in transit") ||
    status.includes("reroute delivery")
  ) {
    return 6;
  }

  if (
    status.includes("pack items") ||
    status.includes("generate shipping label") ||
    status.includes("order transmitted") ||
    status.includes("notify customer") ||
    isLogisticsOrderReceivedStatus(status) ||
    timelineSteps.has("shipment_in_transit") ||
    timelineSteps.has("logistics_fulfillment_started")
  ) {
    return 5;
  }

  if (
    status.includes("service provider confirmed order") ||
    timelineSteps.has("logistics_handoff_accepted")
  ) {
    return 5;
  }

  if (
    status.includes("logistics handoff") ||
    timelineSteps.has("logistics_handoff_created")
  ) {
    return 4;
  }

  if (status.includes("inventory reserved")) {
    return 2;
  }

  if (
    status.includes("order validated") ||
    timelineSteps.has("order_validated") ||
    timelineSteps.has("sales_validated") ||
    timelineSteps.has("purchase_order_received")
  ) {
    return 1;
  }

  return 0;
}

export function getWorkflowStageIndexFromSalesOrder(input: {
  status: string;
  timeline?: Array<{ step?: string }>;
}) {
  const status = input.status.toLowerCase();
  const timelineSteps = new Set(
    (input.timeline ?? [])
      .map((item) => item.step)
      .filter((value): value is string => Boolean(value)),
  );

  if (
    status.includes("delivered") ||
    timelineSteps.has("logistics_order_delivered")
  ) {
    return 10;
  }

  if (status.includes("blubook system updated")) {
    return 9;
  }

  if (status.includes("customer receives") || status.includes("signs pod")) {
    return 8;
  }

  if (status.includes("order arrives at destination")) {
    return 7;
  }

  if (
    status.includes("track shipment in transit") ||
    status.includes("reroute delivery")
  ) {
    return 6;
  }

  if (
    status.includes("pack items") ||
    status.includes("generate shipping label") ||
    status.includes("order transmitted") ||
    status.includes("notify customer") ||
    isLogisticsOrderReceivedStatus(status) ||
    timelineSteps.has("shipment_in_transit") ||
    timelineSteps.has("logistics_fulfillment_started")
  ) {
    return 5;
  }

  if (
    status.includes("service provider confirmed order") ||
    timelineSteps.has("logistics_handoff_accepted")
  ) {
    return 4;
  }

  if (
    status.includes("logistics handoff") ||
    timelineSteps.has("logistics_handoff_created")
  ) {
    return 3;
  }

  if (
    status.includes("invoice generated") ||
    status.includes("packaging") ||
    status.includes("manufacturing") ||
    status.includes("pick ticket") ||
    status.includes("work order created")
  ) {
    return 3;
  }

  if (status.includes("inventory reserved")) {
    return 2;
  }

  if (
    status.includes("order validated") ||
    timelineSteps.has("order_validated") ||
    timelineSteps.has("sales_validated") ||
    timelineSteps.has("purchase_order_received")
  ) {
    return 1;
  }

  return 0;
}

export function getWorkflowStageIndexFromHandoffStatus(
  handoffStatus:
    | "pending"
    | "accepted"
    | "in_progress"
    | "completed"
    | "rejected",
) {
  if (handoffStatus === "completed") {
    return 4;
  }

  if (handoffStatus === "in_progress") {
    return 3;
  }

  if (handoffStatus === "accepted") {
    return 2;
  }

  if (handoffStatus === "pending" || handoffStatus === "rejected") {
    return 1;
  }

  return 0;
}

export function WorkflowProgress({
  currentIndex,
  completedStepKeys,
  compact = false,
  variant = "customer",
}: {
  /**
   * @deprecated Prefer `completedStepKeys`. When both are provided,
   * `completedStepKeys` takes precedence so the tracker is driven purely
   * by recorded step events rather than inferred order status.
   */
  currentIndex?: number;
  /** Step keys from order_workflow_step_events. Derives stage index automatically. */
  completedStepKeys?: string[];
  compact?: boolean;
  variant?: "customer" | "sales";
}) {
  const resolvedIndex =
    completedStepKeys !== undefined
      ? deriveStageIndexFromStepKeys(completedStepKeys)
      : (currentIndex ?? 0);

  const stageOrder =
    variant === "sales" ? SALES_WORKFLOW_STAGE_ORDER : WORKFLOW_STAGE_ORDER;
  const stageLabels =
    variant === "sales" ? SALES_WORKFLOW_STAGE_LABELS : WORKFLOW_STAGE_LABELS;
  const stageIcons: Record<string, LucideIcon> =
    variant === "sales" ? SALES_WORKFLOW_STAGE_ICONS : WORKFLOW_STAGE_ICONS;

  const clampedIndex = Math.max(
    0,
    Math.min(resolvedIndex, stageOrder.length - 1),
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollControls = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextCanScrollLeft = el.scrollLeft > 4;
    const nextCanScrollRight = el.scrollLeft < maxScrollLeft - 4;

    setCanScrollLeft(nextCanScrollLeft);
    setCanScrollRight(nextCanScrollRight);
  }, []);

  useEffect(() => {
    updateScrollControls();

    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const onScroll = () => updateScrollControls();
    el.addEventListener("scroll", onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollControls());
    resizeObserver.observe(el);
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [stageOrder.length, updateScrollControls]);

  function scrollSteps(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    el.scrollBy({
      left: direction === "left" ? -260 : 260,
      behavior: "smooth",
    });
  }

  return (
    <div
      className={cn(
        "w-full",
        compact
          ? ""
          : "rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Scroll workflow steps left"
          onClick={() => scrollSteps("left")}
          disabled={!canScrollLeft}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
            canScrollLeft
              ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-100"
              : "border-slate-300 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div ref={scrollRef} className="overflow-x-hidden flex-1">
          <div className="flex min-w-max items-center gap-3">
            {stageOrder.map((stage, index) => {
              const Icon = stageIcons[stage];
              const complete = index < clampedIndex;
              const current = index === clampedIndex;

              return (
                <div
                  key={stage}
                  className="flex min-w-[170px] items-center gap-2"
                >
                  <div
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                      complete
                        ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-700 dark:text-emerald-200"
                        : current
                          ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-700 dark:text-cyan-100"
                          : "border-slate-300 bg-slate-50 text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-400",
                    )}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  {!compact ? (
                    <p
                      title={stageLabels[stage as keyof typeof stageLabels]}
                      className={cn(
                        "text-xs leading-4 whitespace-nowrap",
                        current || complete
                          ? "text-slate-700 dark:text-slate-200"
                          : "text-slate-500 dark:text-slate-400",
                      )}
                    >
                      {stageLabels[stage as keyof typeof stageLabels]}
                    </p>
                  ) : null}

                  {index < stageOrder.length - 1 ? (
                    <div
                      className={cn(
                        "h-px w-10 shrink-0",
                        index < clampedIndex
                          ? "bg-emerald-300/50"
                          : "bg-slate-300 dark:bg-white/10",
                      )}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          aria-label="Scroll workflow steps right"
          onClick={() => scrollSteps("right")}
          disabled={!canScrollRight}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
            canScrollRight
              ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-100"
              : "border-slate-300 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

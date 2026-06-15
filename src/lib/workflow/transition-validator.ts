import { createAdminClient } from "@/lib/supabase/admin";
import {
  getWorkflowStep,
  type WorkflowStepOwner,
} from "@/lib/workflow/workflow-step-contract";
import type { WorkflowEventType } from "@/lib/workflow/types";

/**
 * Single source of truth for all valid state machine transitions.
 *
 * Key   = workflow event type
 * Value = set of order statuses from which this event is allowed.
 *         Empty / absent entry means the event is unrestricted (allowed from any status).
 *
 * Both the sales and logistics event processors must call `assertValidTransition`
 * instead of maintaining their own local guard maps.
 */
export const WORKFLOW_TRANSITION_GUARDS: Readonly<
  Partial<Record<WorkflowEventType, readonly string[]>>
> = {
  // ─── Sales ──────────────────────────────────────────────────────────────────
  "order.validated": ["Purchase Order Received"],
  "order.packaged": ["Packaging"],

  // ─── Logistics ──────────────────────────────────────────────────────────────
  "logistics.order_received": [
    "Service Provider Confirmed Order",
    "Order Received",
  ],
  "logistics.warehouse_transmitted": [
    "Order Received",
    "Order Transmitted to Warehouse",
  ],
  "logistics.customer_notified": [
    "Order Transmitted to Warehouse",
    "Notify Customer",
  ],
  "logistics.items_packed": [
    "Order Transmitted to Warehouse",
    "Notify Customer",
    "Pack Items for Shipment",
  ],
  "logistics.shipping_label_generated": [
    "Pack Items for Shipment",
    "Generate Shipping Label & Documentation",
  ],
  "order.shipped": [
    "Generate Shipping Label & Documentation",
    "Track Shipment In Transit",
  ],
  "logistics.reroute_delivery": [
    "Track Shipment In Transit",
    "Reroute Delivery",
  ],
  "logistics.reroute_complete": [
    "Reroute Delivery",
    "Track Shipment In Transit",
  ],
  "logistics.order_arrived": [
    "Track Shipment In Transit",
    "Order Arrives at Destination",
  ],
  "logistics.pod_signed": [
    "Order Arrives at Destination",
    "Customer Receives & Signs POD",
  ],
  "logistics.system_updated": [
    "Customer Receives & Signs POD",
    "BluBook System Updated",
  ],
  "order.delivered": ["BluBook System Updated", "Delivered"],
} as const;

type TransitionContractRule = {
  stepKey: string;
  owner: WorkflowStepOwner;
};

const TRANSITION_CONTRACT_RULES: Partial<
  Record<WorkflowEventType, TransitionContractRule>
> = {
  "order.validated": {
    stepKey: "order_validated",
    owner: "sales",
  },
  "order.packaged": {
    stepKey: "invoice_generated",
    owner: "sales",
  },
  "logistics.order_received": {
    stepKey: "order_received",
    owner: "logistics",
  },
  "logistics.warehouse_transmitted": {
    stepKey: "order_transmitted_to_warehouse",
    owner: "logistics",
  },
  "logistics.customer_notified": {
    stepKey: "notify_customer",
    owner: "logistics",
  },
  "logistics.items_packed": {
    stepKey: "pack_items_for_shipment",
    owner: "logistics",
  },
  "logistics.shipping_label_generated": {
    stepKey: "generate_shipping_label_documentation",
    owner: "logistics",
  },
  "order.shipped": {
    stepKey: "track_shipment_in_transit",
    owner: "logistics",
  },
  "logistics.reroute_delivery": {
    stepKey: "reroute_delivery",
    owner: "logistics",
  },
  "logistics.order_arrived": {
    stepKey: "order_arrives_at_destination",
    owner: "logistics",
  },
  "logistics.pod_signed": {
    stepKey: "customer_receives_signs_pod",
    owner: "logistics",
  },
  "logistics.system_updated": {
    stepKey: "blubook_system_updated",
    owner: "logistics",
  },
  "order.delivered": {
    stepKey: "delivered",
    owner: "logistics",
  },
};

type WorkflowEventLedgerRow = {
  step_key: string;
  proof_url: string | null;
  proof_type: string | null;
};

function hasEventProof(row: WorkflowEventLedgerRow | undefined) {
  return Boolean(row?.proof_url || row?.proof_type);
}

/**
 * Returns the set of allowed source statuses for an event, or `undefined`
 * if the event has no transition restriction.
 */
export function getAllowedTransitionStatuses(
  eventType: WorkflowEventType,
): readonly string[] | undefined {
  return WORKFLOW_TRANSITION_GUARDS[eventType];
}

/**
 * Centralized guard that rejects invalid state changes.
 *
 * Fetches the current order status and throws if the requested transition
 * is not permitted. No-ops when the event type has no restriction.
 *
 * @throws Error when the order is not found or the transition is invalid.
 */
export async function assertValidTransition(
  orderId: string,
  eventType: WorkflowEventType,
): Promise<void> {
  const allowed = getAllowedTransitionStatuses(eventType);
  if (!allowed || allowed.length === 0) {
    return;
  }

  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("sales_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  if (!allowed.includes(order.status)) {
    throw new Error(
      `Cannot process ${eventType} from status '${order.status}'. Allowed: ${[...allowed].join(", ")}.`,
    );
  }

  const contractRule = TRANSITION_CONTRACT_RULES[eventType];
  if (!contractRule) {
    return;
  }

  const targetStep = getWorkflowStep(contractRule.stepKey);
  if (!targetStep) {
    throw new Error(
      `Transition contract misconfigured for ${eventType}: unknown step '${contractRule.stepKey}'.`,
    );
  }

  if (targetStep.owner !== contractRule.owner) {
    throw new Error(
      `Transition contract misconfigured for ${eventType}: step '${targetStep.key}' is owned by '${targetStep.owner}', expected '${contractRule.owner}'.`,
    );
  }

  const { data: stepRows, error: stepsError } = await admin
    .from("order_workflow_step_events")
    .select("step_key, proof_url, proof_type")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (stepsError) {
    throw new Error(
      `Failed to load workflow step events for order ${orderId}: ${stepsError.message}`,
    );
  }

  const rows = (stepRows ?? []) as WorkflowEventLedgerRow[];
  const completedSteps = new Set(rows.map((row) => row.step_key));

  const missingPreviousSteps = targetStep.allowedPreviousSteps.filter(
    (stepKey) => !completedSteps.has(stepKey),
  );

  if (missingPreviousSteps.length > 0) {
    throw new Error(
      `Cannot process ${eventType}: missing required previous steps: ${missingPreviousSteps.join(", ")}.`,
    );
  }

  const latestByStep = new Map<string, WorkflowEventLedgerRow>();
  for (const row of rows) {
    latestByStep.set(row.step_key, row);
  }

  const missingProofSteps = targetStep.allowedPreviousSteps.filter(
    (stepKey) => {
      const step = getWorkflowStep(stepKey);
      if (!step || step.proofRequirements.length === 0) {
        return false;
      }

      return !hasEventProof(latestByStep.get(stepKey));
    },
  );

  if (missingProofSteps.length > 0) {
    throw new Error(
      `Cannot process ${eventType}: required proof is missing for prerequisite steps: ${missingProofSteps.join(", ")}.`,
    );
  }
}

import { expect, test } from "@playwright/test";
import {
  getWorkflowStageIndexFromOrder,
  getWorkflowStepMatrixIndexes,
} from "@/components/ui/workflow-progress";
import { WORKFLOW_STAGE_LABELS } from "@/constants/workflow-stage-labels";
import {
  DELIVERED_PROOF_REQUIREMENTS,
  WORKFLOW_STEP_CONTRACT,
  WORKFLOW_STEP_COUNT,
  getWorkflowStepsByOwner,
  getWorkflowStepsForAudience,
  buildAudienceStepView,
} from "@/lib/workflow/workflow-step-contract";
import {
  SALES_TRANSITION_GUARDS,
  isAllowedSalesTransition,
} from "@/lib/workflow/sales-transition-guards";

const STAGE_ORDER = [
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
] as const;

function completedStageLabels(currentIndex: number) {
  return STAGE_ORDER.filter((_, index) => index < currentIndex).map(
    (stageKey) => WORKFLOW_STAGE_LABELS[stageKey],
  );
}

function logCase(message: string, data?: unknown) {
  if (data === undefined) {
    console.log(`[workflow-step-logic] ${message}`);
    return;
  }

  console.log(
    `[workflow-step-logic] ${message}: ${JSON.stringify(data, null, 2)}`,
  );
}

test.describe("workflow step logic (no UI navigation)", () => {
  test("defines the canonical 17-step interaction contract", () => {
    const salesSteps = getWorkflowStepsByOwner("sales");
    const logisticsSteps = getWorkflowStepsByOwner("logistics");

    logCase("test-0 workflow contract", WORKFLOW_STEP_CONTRACT);
    logCase(
      "test-0 sales steps",
      salesSteps.map((step) => step.label),
    );
    logCase(
      "test-0 logistics steps",
      logisticsSteps.map((step) => step.label),
    );

    expect(WORKFLOW_STEP_COUNT).toBe(17);
    expect(salesSteps).toHaveLength(6);
    expect(logisticsSteps).toHaveLength(11);
    expect(WORKFLOW_STEP_CONTRACT.at(-1)?.terminal).toBe(true);
    expect(DELIVERED_PROOF_REQUIREMENTS).toContain("proof-of-delivery");
    expect(
      WORKFLOW_STEP_CONTRACT.filter((step) => step.requiresInteraction),
    ).toHaveLength(17);
    logCase("test-0 assertions passed");
  });

  test("guards sales transitions at explicit checkpoints", () => {
    logCase("test-0b sales guards", SALES_TRANSITION_GUARDS);

    expect(
      isAllowedSalesTransition({
        eventType: "order.validated",
        currentStatus: "Purchase Order Received",
      }),
    ).toBe(true);
    expect(
      isAllowedSalesTransition({
        eventType: "order.validated",
        currentStatus: "Delivered",
      }),
    ).toBe(false);
    expect(
      isAllowedSalesTransition({
        eventType: "order.packaged",
        currentStatus: "Packaging",
      }),
    ).toBe(true);
    expect(
      isAllowedSalesTransition({
        eventType: "order.packaged",
        currentStatus: "Invoice Generated",
      }),
    ).toBe(false);
    logCase("test-0b assertions passed");
  });

  test("keeps only PO Submitted complete at initial received state", () => {
    const input = {
      status: "Purchase Order Received",
      timeline: [{ step: "purchase_order_received" }],
    };
    logCase("test-1 input", input);

    const stageIndex = getWorkflowStageIndexFromOrder({
      status: input.status,
      timeline: input.timeline,
    });

    const completed = completedStageLabels(stageIndex);
    logCase("test-1 stage index", stageIndex);
    logCase("test-1 completed labels", completed);

    expect(stageIndex).toBe(1);
    expect(completed).toEqual(["PO Submitted"]);

    const matrix = getWorkflowStepMatrixIndexes({
      status: input.status,
      timeline: input.timeline,
    });
    logCase("test-1 matrix", matrix);

    expect(matrix.salesIndex).toBe(0);
    expect(matrix.logisticsIndex).toBe(0);
    logCase("test-1 assertions passed");
  });

  test("does not mark logistics-owned steps complete from logistics_order_received timeline alone", () => {
    const input = {
      status: "Logistics Handoff Created",
      timeline: [
        { step: "purchase_order_received" },
        { step: "logistics_handoff_created" },
        { step: "logistics_order_received" },
      ],
    };
    logCase("test-2 input", input);

    const stageIndex = getWorkflowStageIndexFromOrder({
      status: input.status,
      timeline: input.timeline,
    });

    const completed = completedStageLabels(stageIndex);
    logCase("test-2 stage index", stageIndex);
    logCase("test-2 completed labels", completed);

    expect(stageIndex).toBe(3);
    expect(completed).toEqual([
      "PO Submitted",
      "Sales Validated",
      "Inventory Reserved",
    ]);
    expect(completed).not.toContain("Handoff Created (Sales Confirmed PO)");
    expect(completed).not.toContain("Handoff Confirmed (Logistics Accepted)");
    logCase("test-2 assertions passed");
  });

  test("maps explicit logistics acceptance into confirmed stage", () => {
    const input = {
      status: "Service Provider Confirmed Order",
      timeline: [{ step: "logistics_handoff_accepted" }],
    };
    logCase("test-3 input", input);

    const stageIndex = getWorkflowStageIndexFromOrder({
      status: input.status,
      timeline: input.timeline,
    });
    logCase("test-3 stage index", stageIndex);

    expect(stageIndex).toBe(4);

    const matrix = getWorkflowStepMatrixIndexes({
      status: input.status,
      timeline: input.timeline,
    });
    logCase("test-3 matrix", matrix);

    expect(matrix.salesIndex).toBeGreaterThanOrEqual(8);
    expect(matrix.logisticsIndex).toBe(0);
    logCase("test-3 assertions passed");
  });
});

test.describe("forbidden auto-advance invariants", () => {
  test("upload state produces zero logistics-owned completed steps", () => {
    const uploadedState = {
      status: "Purchase Order Received",
      timeline: [{ step: "customer_po_uploaded" }, { step: "order_created" }],
    };
    logCase("invariant-1 input", uploadedState);

    const stageIndex = getWorkflowStageIndexFromOrder(uploadedState);
    const completed = completedStageLabels(stageIndex);
    logCase("invariant-1 completed labels", completed);

    const logisticsStepLabels = getWorkflowStepsByOwner("logistics").map(
      (step) => step.label,
    );
    const logisticsCompletedFromUpload = completed.filter((label) =>
      logisticsStepLabels.includes(label),
    );

    expect(logisticsCompletedFromUpload).toHaveLength(0);
    logCase(
      "invariant-1 passed: no logistics steps auto-completed from upload",
    );
  });

  test("delivered step requires proof-of-delivery in contract", () => {
    const deliveredStep = WORKFLOW_STEP_CONTRACT.find(
      (step) => step.key === "delivered",
    );
    logCase("invariant-2 delivered step", deliveredStep);

    expect(deliveredStep).toBeDefined();
    expect(deliveredStep?.terminal).toBe(true);
    expect(deliveredStep?.proofRequirements).toContain("proof-of-delivery");
    logCase("invariant-2 passed: delivered is terminal and proof-gated");
  });

  test("order.validated rejected from Delivered status by sales guard", () => {
    const result = isAllowedSalesTransition({
      eventType: "order.validated",
      currentStatus: "Delivered",
    });
    logCase("invariant-3", { allowed: result });

    expect(result).toBe(false);
    logCase("invariant-3 passed: order.validated blocked from Delivered");
  });

  test("order.validated rejected from logistics-owned statuses", () => {
    const logisticsOwnedStatuses = [
      "Order Received",
      "Pack Items for Shipment",
      "Track Shipment In Transit",
      "Customer Receives & Signs POD",
      "BluBook System Updated",
    ];

    for (const status of logisticsOwnedStatuses) {
      const result = isAllowedSalesTransition({
        eventType: "order.validated",
        currentStatus: status,
      });
      logCase(`invariant-4 order.validated from '${status}'`, {
        allowed: result,
      });
      expect(result).toBe(false);
    }

    logCase(
      "invariant-4 passed: order.validated blocked from all logistics statuses",
    );
  });

  test("sales_validated timeline does not complete logistics-owned progress", () => {
    const state = {
      status: "Order Validated",
      timeline: [
        { step: "purchase_order_received" },
        { step: "order_validated" },
      ],
    };
    logCase("invariant-5 input", state);

    const stageIndex = getWorkflowStageIndexFromOrder(state);
    const completed = completedStageLabels(stageIndex);
    logCase("invariant-5 completed labels", completed);

    const logisticsStepLabels = getWorkflowStepsByOwner("logistics").map(
      (step) => step.label,
    );
    const logisticsAutoCompleted = completed.filter((label) =>
      logisticsStepLabels.includes(label),
    );

    expect(logisticsAutoCompleted).toHaveLength(0);
    logCase(
      "invariant-5 passed: sales validation does not complete logistics steps",
    );
  });
});

test.describe("visibleTo audience filtering", () => {
  test("customer sees only their relevant steps (7 steps)", () => {
    const customerSteps = getWorkflowStepsForAudience("customer");
    logCase(
      "visibleTo-1 customer steps",
      customerSteps.map((s) => s.key),
    );

    const EXPECTED_CUSTOMER_KEYS = [
      "purchase_order_received",
      "invoice_generated",
      "shipment_created",
      "notify_customer",
      "track_shipment_in_transit",
      "order_arrives_at_destination",
      "customer_receives_signs_pod",
      "delivered",
    ];

    expect(customerSteps).toHaveLength(EXPECTED_CUSTOMER_KEYS.length);
    for (const key of EXPECTED_CUSTOMER_KEYS) {
      expect(customerSteps.map((s) => s.key)).toContain(key);
    }

    // Internal-only steps must NOT appear for customers
    const hiddenFromCustomer = [
      "order_validated",
      "inventory_reserved",
      "order_received",
      "order_transmitted_to_warehouse",
      "pack_items_for_shipment",
      "generate_shipping_label_documentation",
      "reroute_delivery",
      "blubook_system_updated",
    ];
    for (const key of hiddenFromCustomer) {
      expect(customerSteps.map((s) => s.key)).not.toContain(key);
    }
    logCase("visibleTo-1 passed: customer sees only their relevant steps");
  });

  test("sales sees all 6 own steps plus 2 cross-boundary logistics steps", () => {
    const salesSteps = getWorkflowStepsForAudience("sales");
    logCase(
      "visibleTo-2 sales steps",
      salesSteps.map((s) => s.key),
    );

    // All 6 sales-owned steps
    const salesOwned = salesSteps.filter((s) => s.owner === "sales");
    expect(salesOwned).toHaveLength(6);

    // Cross-boundary: order_received and delivered
    const crossBoundary = salesSteps.filter((s) => s.owner === "logistics");
    const crossKeys = crossBoundary.map((s) => s.key);
    expect(crossKeys).toContain("order_received");
    expect(crossKeys).toContain("delivered");

    // Internal logistics steps hidden from sales
    expect(crossKeys).not.toContain("pack_items_for_shipment");
    expect(crossKeys).not.toContain("blubook_system_updated");
    logCase("visibleTo-2 passed: sales sees own steps + handoff boundary");
  });

  test("logistics sees all 11 own steps plus 2 cross-boundary sales steps", () => {
    const logisticsSteps = getWorkflowStepsForAudience("logistics");
    logCase(
      "visibleTo-3 logistics steps",
      logisticsSteps.map((s) => s.key),
    );

    const logisticsOwned = logisticsSteps.filter(
      (s) => s.owner === "logistics",
    );
    expect(logisticsOwned).toHaveLength(11);

    const crossBoundary = logisticsSteps.filter((s) => s.owner === "sales");
    const crossKeys = crossBoundary.map((s) => s.key);
    expect(crossKeys).toContain("logistics_handoff_created");
    expect(crossKeys).toContain("shipment_created");

    // Internal sales steps hidden from logistics
    expect(crossKeys).not.toContain("order_validated");
    expect(crossKeys).not.toContain("inventory_reserved");
    logCase(
      "visibleTo-3 passed: logistics sees own steps + incoming handoff boundary",
    );
  });

  test("staff sees all 17 steps regardless of visibleTo", () => {
    const staffSteps = getWorkflowStepsForAudience("staff");
    logCase("visibleTo-4 staff step count", staffSteps.length);

    expect(staffSteps).toHaveLength(17);
    logCase("visibleTo-4 passed: staff sees all 17 steps");
  });
});

test.describe("event-driven completion (buildAudienceStepView)", () => {
  test("empty completedStepKeys renders all steps as not completed", () => {
    const view = buildAudienceStepView({
      audience: "customer",
      completedStepKeys: [],
    });
    logCase(
      "event-1 view (empty keys)",
      view.map((s) => ({ key: s.key, completed: s.completed })),
    );

    expect(view.every((s) => !s.completed)).toBe(true);
    expect(view[0]?.current).toBe(true);
    logCase("event-1 passed: all steps incomplete with empty keys");
  });

  test("first step complete moves current marker to second step", () => {
    const view = buildAudienceStepView({
      audience: "customer",
      completedStepKeys: ["purchase_order_received"],
    });
    const firstStep = view.find((s) => s.key === "purchase_order_received");
    const secondStep = view.find((s) => s.key === "invoice_generated");

    expect(firstStep?.completed).toBe(true);
    expect(firstStep?.current).toBe(false);
    expect(secondStep?.current).toBe(true);
    logCase("event-2 passed: current advances past completed step");
  });

  test("delivering all steps marks terminal step as complete and no step as current", () => {
    const allKeys = WORKFLOW_STEP_CONTRACT.map((s) => s.key);
    const view = buildAudienceStepView({
      audience: "staff",
      completedStepKeys: allKeys,
    });
    logCase("event-3 all completed check");

    expect(view.every((s) => s.completed)).toBe(true);
    expect(view.every((s) => !s.current)).toBe(true);
    expect(view.find((s) => s.key === "delivered")?.completed).toBe(true);
    logCase(
      "event-3 passed: all steps complete, no current marker, delivered is complete",
    );
  });

  test("sales and logistics steps never appear in customer view", () => {
    const view = buildAudienceStepView({
      audience: "customer",
      completedStepKeys: [],
    });
    const internalOnlyKeys = [
      "order_validated",
      "inventory_reserved",
      "order_received",
      "order_transmitted_to_warehouse",
      "pack_items_for_shipment",
      "generate_shipping_label_documentation",
      "reroute_delivery",
      "blubook_system_updated",
    ];

    for (const key of internalOnlyKeys) {
      expect(view.map((s) => s.key)).not.toContain(key);
    }
    logCase("event-4 passed: internal-only steps absent from customer view");
  });
});

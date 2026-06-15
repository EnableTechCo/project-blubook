/**
 * Three-party workflow sequence logic tests
 *
 * Validates the full Customer → Sales → Logistics interaction chain using
 * pure logic (no browser, no DB, no web server).
 *
 * Strategy:
 *  - completedStepKeys accumulates as each party "records" their steps
 *  - At every checkpoint, all three audiences are asserted simultaneously
 *  - Cross-boundary visibility is explicitly verified at handoff points
 *  - No step is ever inferred — only what is in completedStepKeys is complete
 *
 * Run with:
 *   $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:65535'
 *   npx playwright test tests/e2e/logic/three-party-workflow-sequence.spec.ts --project=chromium --reporter=line
 */

import { expect, test } from "@playwright/test";
import {
  WORKFLOW_STEP_CONTRACT,
  buildAudienceStepView,
  getWorkflowStepsForAudience,
} from "@/lib/workflow/workflow-step-contract";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function viewFor(
  audience: "customer" | "sales" | "logistics" | "staff",
  completedStepKeys: string[],
) {
  return buildAudienceStepView({ audience, completedStepKeys });
}

function completedKeys(
  audience: "customer" | "sales" | "logistics" | "staff",
  completedStepKeys: string[],
) {
  return viewFor(audience, completedStepKeys)
    .filter((s) => s.completed)
    .map((s) => s.key);
}

function currentKey(
  audience: "customer" | "sales" | "logistics" | "staff",
  completedStepKeys: string[],
) {
  return (
    viewFor(audience, completedStepKeys).find((s) => s.current)?.key ?? null
  );
}

function log(label: string, data?: unknown) {
  if (data === undefined) {
    console.log(`[3-party] ${label}`);
  } else {
    console.log(`[3-party] ${label}: ${JSON.stringify(data, null, 2)}`);
  }
}

// ─── Full step sequence in canonical contract order ───────────────────────────

const ALL_STEP_KEYS = WORKFLOW_STEP_CONTRACT.map((s) => s.key);

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("three-party workflow sequence (no UI, no DB)", () => {
  /**
   * CHECKPOINT 0 — No steps recorded yet (order just created)
   * Customer: sees their 8 steps, none complete, purchase_order_received is current
   * Sales: sees their 8 steps, none complete, purchase_order_received is current
   * Logistics: sees their 13 steps, none complete, logistics_handoff_created is current
   */
  test("checkpoint 0: fresh order — no steps complete for any party", () => {
    const completed: string[] = [];
    log("checkpoint-0: completed keys", completed);

    // Customer
    const customerCompleted = completedKeys("customer", completed);
    const customerCurrent = currentKey("customer", completed);
    expect(customerCompleted).toHaveLength(0);
    expect(customerCurrent).toBe("purchase_order_received");

    // Sales
    const salesCompleted = completedKeys("sales", completed);
    const salesCurrent = currentKey("sales", completed);
    expect(salesCompleted).toHaveLength(0);
    expect(salesCurrent).toBe("purchase_order_received");

    // Logistics
    const logisticsCompleted = completedKeys("logistics", completed);
    const logisticsCurrent = currentKey("logistics", completed);
    expect(logisticsCompleted).toHaveLength(0);
    // Logistics' first visible step is logistics_handoff_created (incoming from sales)
    expect(logisticsCurrent).toBe("logistics_handoff_created");

    log("checkpoint-0 passed");
  });

  /**
   * CHECKPOINT 1 — Customer uploads PO
   * Actor: customer (step owner: sales)
   * Step recorded: purchase_order_received
   *
   * Customer: sees PO Received as complete, next = invoice_generated
   * Sales: sees PO Received as complete, next = order_validated
   * Logistics: no change — this step is not visible to logistics
   */
  test("checkpoint 1: customer uploads PO — purchase_order_received recorded", () => {
    const completed = ["purchase_order_received"];
    log("checkpoint-1: completed keys", completed);

    // Customer sees it complete
    const customerView = viewFor("customer", completed);
    const customerPO = customerView.find(
      (s) => s.key === "purchase_order_received",
    );
    expect(customerPO?.completed).toBe(true);
    // Customer's next visible step is invoice_generated
    expect(currentKey("customer", completed)).toBe("invoice_generated");

    // Sales sees it complete, next step is order_validated
    const salesPO = viewFor("sales", completed).find(
      (s) => s.key === "purchase_order_received",
    );
    expect(salesPO?.completed).toBe(true);
    expect(currentKey("sales", completed)).toBe("order_validated");

    // Logistics: purchase_order_received is NOT in their visible set
    const logisticsView = viewFor("logistics", completed);
    expect(logisticsView.map((s) => s.key)).not.toContain(
      "purchase_order_received",
    );
    // Logistics still waiting on logistics_handoff_created
    expect(currentKey("logistics", completed)).toBe(
      "logistics_handoff_created",
    );

    log("checkpoint-1 passed");
  });

  /**
   * CHECKPOINT 2 — Sales completes their internal steps
   * Steps recorded: order_validated, inventory_reserved
   *
   * Customer: no change visible (these are internal sales steps)
   * Sales: two more steps complete
   * Logistics: no change
   */
  test("checkpoint 2: sales validates and reserves inventory", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
    ];
    log("checkpoint-2: completed keys", completed);

    // Customer: order_validated and inventory_reserved are NOT in customer's visible set
    const customerKeys = getWorkflowStepsForAudience("customer").map(
      (s) => s.key,
    );
    expect(customerKeys).not.toContain("order_validated");
    expect(customerKeys).not.toContain("inventory_reserved");
    // Customer still waiting on invoice_generated
    expect(currentKey("customer", completed)).toBe("invoice_generated");

    // Sales: three steps complete, next = logistics_handoff_created
    expect(completedKeys("sales", completed)).toEqual(
      expect.arrayContaining([
        "purchase_order_received",
        "order_validated",
        "inventory_reserved",
      ]),
    );
    expect(currentKey("sales", completed)).toBe("logistics_handoff_created");

    // Logistics: no change
    expect(currentKey("logistics", completed)).toBe(
      "logistics_handoff_created",
    );

    log("checkpoint-2 passed");
  });

  /**
   * CHECKPOINT 3 — Sales creates logistics handoff
   * Step recorded: logistics_handoff_created
   *
   * This is a cross-boundary step: visible to BOTH sales AND logistics.
   *
   * Customer: no change (logistics_handoff_created not in customer set)
   * Sales: logistics_handoff_created complete, next = invoice_generated
   * Logistics: logistics_handoff_created NOW appears as complete — handoff received
   *            next = shipment_created (next cross-boundary visible step)
   */
  test("checkpoint 3: sales creates handoff — cross-boundary visibility triggers for logistics", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
    ];
    log("checkpoint-3: completed keys", completed);

    // Customer: logistics_handoff_created not visible
    expect(viewFor("customer", completed).map((s) => s.key)).not.toContain(
      "logistics_handoff_created",
    );
    expect(currentKey("customer", completed)).toBe("invoice_generated");

    // Sales: handoff complete, next = invoice_generated
    const salesHandoff = viewFor("sales", completed).find(
      (s) => s.key === "logistics_handoff_created",
    );
    expect(salesHandoff?.completed).toBe(true);
    expect(currentKey("sales", completed)).toBe("invoice_generated");

    // Logistics: cross-boundary step NOW shows completed
    const logisticsHandoff = viewFor("logistics", completed).find(
      (s) => s.key === "logistics_handoff_created",
    );
    expect(logisticsHandoff?.completed).toBe(true);
    // Logistics next is shipment_created (also cross-boundary, also not yet complete)
    expect(currentKey("logistics", completed)).toBe("shipment_created");

    log("checkpoint-3 passed: cross-boundary handoff visible to logistics");
  });

  /**
   * CHECKPOINT 4 — Sales generates invoice and creates shipment
   * Steps recorded: invoice_generated, shipment_created
   *
   * invoice_generated: visible to sales + customer
   * shipment_created: visible to sales + logistics + customer
   *
   * Customer: sees invoice_generated and shipment_created as complete
   *           next = notify_customer
   * Sales: 6/6 own steps complete, next watching = order_received
   * Logistics: shipment_created now complete, next = order_received
   */
  test("checkpoint 4: sales completes pipeline — customer and logistics see shipment_created", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
      "invoice_generated",
      "shipment_created",
    ];
    log("checkpoint-4: completed keys", completed);

    // Customer: sees invoice + shipment complete, now waiting on notify_customer
    const customerView = viewFor("customer", completed);
    expect(
      customerView.find((s) => s.key === "invoice_generated")?.completed,
    ).toBe(true);
    expect(
      customerView.find((s) => s.key === "shipment_created")?.completed,
    ).toBe(true);
    expect(currentKey("customer", completed)).toBe("notify_customer");

    // Sales: all 6 own steps complete, monitoring logistics — current = order_received
    const salesCompleted = completedKeys("sales", completed).filter((k) =>
      [
        "purchase_order_received",
        "order_validated",
        "inventory_reserved",
        "logistics_handoff_created",
        "invoice_generated",
        "shipment_created",
      ].includes(k),
    );
    expect(salesCompleted).toHaveLength(6);
    expect(currentKey("sales", completed)).toBe("order_received");

    // Logistics: shipment_created complete, now current = order_received
    expect(
      viewFor("logistics", completed).find((s) => s.key === "shipment_created")
        ?.completed,
    ).toBe(true);
    expect(currentKey("logistics", completed)).toBe("order_received");

    log("checkpoint-4 passed: sales pipeline complete, all parties updated");
  });

  /**
   * CHECKPOINT 5 — Logistics accepts order receipt
   * Step recorded: order_received
   *
   * Visible to: logistics + sales (handoff monitoring)
   *
   * Sales: sees order_received complete, now current = delivered (their last watch point)
   * Customer: order_received NOT in customer set — no change
   * Logistics: order_received complete, next = order_transmitted_to_warehouse
   */
  test("checkpoint 5: logistics accepts order — sales sees handoff acknowledged", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
      "invoice_generated",
      "shipment_created",
      "order_received",
    ];
    log("checkpoint-5: completed keys", completed);

    // Sales: order_received complete (cross-boundary watch)
    expect(
      viewFor("sales", completed).find((s) => s.key === "order_received")
        ?.completed,
    ).toBe(true);
    // Sales current moves to delivered (their last visible step)
    expect(currentKey("sales", completed)).toBe("delivered");

    // Customer: order_received not in their set
    expect(viewFor("customer", completed).map((s) => s.key)).not.toContain(
      "order_received",
    );
    expect(currentKey("customer", completed)).toBe("notify_customer");

    // Logistics: order_received done, next = order_transmitted_to_warehouse
    expect(
      viewFor("logistics", completed).find((s) => s.key === "order_received")
        ?.completed,
    ).toBe(true);
    expect(currentKey("logistics", completed)).toBe(
      "order_transmitted_to_warehouse",
    );

    log("checkpoint-5 passed: order_received cross-boundary ack verified");
  });

  /**
   * CHECKPOINT 6 — Logistics mid-fulfillment (internal steps only)
   * Steps recorded: order_transmitted_to_warehouse, pack_items_for_shipment,
   *                 generate_shipping_label_documentation
   *
   * These steps are internal to logistics only.
   * Customer: no change
   * Sales: no change
   * Logistics: three more steps complete
   */
  test("checkpoint 6: logistics internal steps do not affect customer or sales view", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
      "invoice_generated",
      "shipment_created",
      "order_received",
      "order_transmitted_to_warehouse",
      "pack_items_for_shipment",
      "generate_shipping_label_documentation",
    ];
    log("checkpoint-6: completed keys", completed);

    // Customer: still waiting on notify_customer (not yet recorded)
    expect(currentKey("customer", completed)).toBe("notify_customer");
    // These internal steps are not in customer view at all
    const customerKeys = viewFor("customer", completed).map((s) => s.key);
    expect(customerKeys).not.toContain("order_transmitted_to_warehouse");
    expect(customerKeys).not.toContain("pack_items_for_shipment");
    expect(customerKeys).not.toContain("generate_shipping_label_documentation");

    // Sales: still watching delivered
    expect(currentKey("sales", completed)).toBe("delivered");

    // Logistics: internal steps complete, next = notify_customer
    expect(currentKey("logistics", completed)).toBe("notify_customer");

    log("checkpoint-6 passed: internal logistics steps isolated");
  });

  /**
   * CHECKPOINT 7 — Logistics notifies customer
   * Step recorded: notify_customer
   *
   * Visible to: logistics + customer
   *
   * Customer: notify_customer now complete, next = track_shipment_in_transit
   * Sales: no change (notify_customer not in sales view)
   * Logistics: notify_customer done, next = track_shipment_in_transit
   */
  test("checkpoint 7: logistics notifies customer — cross-boundary step", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
      "invoice_generated",
      "shipment_created",
      "order_received",
      "order_transmitted_to_warehouse",
      "pack_items_for_shipment",
      "generate_shipping_label_documentation",
      "notify_customer",
    ];
    log("checkpoint-7: completed keys", completed);

    // Customer: sees notify_customer complete
    expect(
      viewFor("customer", completed).find((s) => s.key === "notify_customer")
        ?.completed,
    ).toBe(true);
    expect(currentKey("customer", completed)).toBe("track_shipment_in_transit");

    // Sales: notify_customer not in their view
    expect(viewFor("sales", completed).map((s) => s.key)).not.toContain(
      "notify_customer",
    );

    log("checkpoint-7 passed: notify_customer cross-boundary verified");
  });

  /**
   * CHECKPOINT 8 — Shipment in transit and arrives
   * Steps recorded: track_shipment_in_transit, reroute_delivery,
   *                 order_arrives_at_destination
   *
   * track_shipment_in_transit: visible to logistics + customer
   * reroute_delivery: logistics only (exception step)
   * order_arrives_at_destination: logistics + customer
   */
  test("checkpoint 8: transit steps — reroute is logistics-only, arrival is cross-boundary", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
      "invoice_generated",
      "shipment_created",
      "order_received",
      "order_transmitted_to_warehouse",
      "pack_items_for_shipment",
      "generate_shipping_label_documentation",
      "notify_customer",
      "track_shipment_in_transit",
      "reroute_delivery",
      "order_arrives_at_destination",
    ];
    log("checkpoint-8: completed keys", completed);

    // Customer: track + arrival visible and complete; reroute NOT in their view
    const customerKeys = viewFor("customer", completed).map((s) => s.key);
    expect(customerKeys).toContain("track_shipment_in_transit");
    expect(customerKeys).toContain("order_arrives_at_destination");
    expect(customerKeys).not.toContain("reroute_delivery");
    expect(
      viewFor("customer", completed).find(
        (s) => s.key === "track_shipment_in_transit",
      )?.completed,
    ).toBe(true);
    expect(
      viewFor("customer", completed).find(
        (s) => s.key === "order_arrives_at_destination",
      )?.completed,
    ).toBe(true);
    // Customer next = customer_receives_signs_pod
    expect(currentKey("customer", completed)).toBe(
      "customer_receives_signs_pod",
    );

    // Sales: none of these in their view
    const salesKeys = viewFor("sales", completed).map((s) => s.key);
    expect(salesKeys).not.toContain("track_shipment_in_transit");
    expect(salesKeys).not.toContain("reroute_delivery");

    log("checkpoint-8 passed: transit steps cross-boundary verified");
  });

  /**
   * CHECKPOINT 9 — Customer signs POD
   * Step recorded: customer_receives_signs_pod
   *
   * Visible to: logistics + customer
   * Proof-gated: requires proof-of-delivery
   *
   * Customer: POD step complete, next = delivered
   * Sales: not in their view
   * Logistics: POD complete, next = blubook_system_updated
   */
  test("checkpoint 9: customer signs POD — proof-gated cross-boundary step", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
      "invoice_generated",
      "shipment_created",
      "order_received",
      "order_transmitted_to_warehouse",
      "pack_items_for_shipment",
      "generate_shipping_label_documentation",
      "notify_customer",
      "track_shipment_in_transit",
      "reroute_delivery",
      "order_arrives_at_destination",
      "customer_receives_signs_pod",
    ];
    log("checkpoint-9: completed keys", completed);

    // Contract: POD step must have proof-of-delivery requirement
    const podStep = WORKFLOW_STEP_CONTRACT.find(
      (s) => s.key === "customer_receives_signs_pod",
    );
    expect(podStep?.proofRequirements).toContain("proof-of-delivery");

    // Customer: POD complete, next = delivered
    expect(
      viewFor("customer", completed).find(
        (s) => s.key === "customer_receives_signs_pod",
      )?.completed,
    ).toBe(true);
    expect(currentKey("customer", completed)).toBe("delivered");

    // Sales: not in their view
    expect(viewFor("sales", completed).map((s) => s.key)).not.toContain(
      "customer_receives_signs_pod",
    );

    // Logistics: POD complete, next = blubook_system_updated
    expect(
      viewFor("logistics", completed).find(
        (s) => s.key === "customer_receives_signs_pod",
      )?.completed,
    ).toBe(true);
    expect(currentKey("logistics", completed)).toBe("blubook_system_updated");

    log("checkpoint-9 passed: POD proof gate and cross-boundary verified");
  });

  /**
   * CHECKPOINT 10 — Logistics updates system (internal closeout)
   * Step recorded: blubook_system_updated
   *
   * Visible to: logistics only — customer and sales do NOT see this step
   *
   * Customer: no change, still waiting on delivered
   * Sales: no change
   * Logistics: closeout done, next = delivered (terminal)
   */
  test("checkpoint 10: system updated is logistics-internal — customer and sales unaffected", () => {
    const completed = [
      "purchase_order_received",
      "order_validated",
      "inventory_reserved",
      "logistics_handoff_created",
      "invoice_generated",
      "shipment_created",
      "order_received",
      "order_transmitted_to_warehouse",
      "pack_items_for_shipment",
      "generate_shipping_label_documentation",
      "notify_customer",
      "track_shipment_in_transit",
      "reroute_delivery",
      "order_arrives_at_destination",
      "customer_receives_signs_pod",
      "blubook_system_updated",
    ];
    log("checkpoint-10: completed keys", completed);

    // Customer: blubook_system_updated NOT in their view; still waiting on delivered
    expect(viewFor("customer", completed).map((s) => s.key)).not.toContain(
      "blubook_system_updated",
    );
    expect(currentKey("customer", completed)).toBe("delivered");

    // Sales: not in their view either
    expect(viewFor("sales", completed).map((s) => s.key)).not.toContain(
      "blubook_system_updated",
    );

    // Logistics: closeout complete, next = delivered
    expect(
      viewFor("logistics", completed).find(
        (s) => s.key === "blubook_system_updated",
      )?.completed,
    ).toBe(true);
    expect(currentKey("logistics", completed)).toBe("delivered");

    log("checkpoint-10 passed: system updated is logistics-internal");
  });

  /**
   * CHECKPOINT 11 — DELIVERED (terminal)
   * Step recorded: delivered
   *
   * Visible to: logistics + sales + customer (every party sees the terminal state)
   * Proof-gated: requires proof-of-delivery
   *
   * All three parties:
   *   - see delivered as complete
   *   - have no current step (order complete)
   */
  test("checkpoint 11: delivered — terminal state visible to all three parties", () => {
    const completed = [...ALL_STEP_KEYS]; // all 17 recorded
    log("checkpoint-11: all steps complete");

    // Contract: delivered is terminal and proof-gated
    const deliveredStep = WORKFLOW_STEP_CONTRACT.find(
      (s) => s.key === "delivered",
    );
    expect(deliveredStep?.terminal).toBe(true);
    expect(deliveredStep?.proofRequirements).toContain("proof-of-delivery");

    // Customer: delivered visible and complete, no current step
    const customerDelivered = viewFor("customer", completed).find(
      (s) => s.key === "delivered",
    );
    expect(customerDelivered?.completed).toBe(true);
    expect(currentKey("customer", completed)).toBeNull();

    // Sales: delivered visible and complete, no current step
    const salesDelivered = viewFor("sales", completed).find(
      (s) => s.key === "delivered",
    );
    expect(salesDelivered?.completed).toBe(true);
    expect(currentKey("sales", completed)).toBeNull();

    // Logistics: delivered visible and complete, no current step
    const logisticsDelivered = viewFor("logistics", completed).find(
      (s) => s.key === "delivered",
    );
    expect(logisticsDelivered?.completed).toBe(true);
    expect(currentKey("logistics", completed)).toBeNull();

    log(
      "checkpoint-11 passed: delivered terminal state confirmed for all parties",
    );
  });

  /**
   * INVARIANT — Cannot skip steps
   * Recording delivered without POD does not change the contract's proof requirement.
   * Skipping customer_receives_signs_pod and jumping to delivered:
   *   - delivered is technically "complete" in the view (it's in completedStepKeys)
   *   - BUT the contract's proofRequirements still demands proof-of-delivery
   *   - Application layer must enforce this before calling recordStepEvent
   */
  test("invariant: delivered without POD still carries proof requirement in contract", () => {
    // Simulate a bad actor skipping POD and recording delivered directly
    const completedWithoutPOD = ALL_STEP_KEYS.filter(
      (k) => k !== "customer_receives_signs_pod",
    );
    log("invariant-skip-pod: completed without POD", completedWithoutPOD);

    // The contract still demands proof — app layer must check this before write
    const deliveredStep = WORKFLOW_STEP_CONTRACT.find(
      (s) => s.key === "delivered",
    );
    expect(deliveredStep?.proofRequirements).toContain("proof-of-delivery");

    // POD step still shows as incomplete in all views that can see it
    expect(
      viewFor("customer", completedWithoutPOD).find(
        (s) => s.key === "customer_receives_signs_pod",
      )?.completed,
    ).toBe(false);
    expect(
      viewFor("logistics", completedWithoutPOD).find(
        (s) => s.key === "customer_receives_signs_pod",
      )?.completed,
    ).toBe(false);

    log("invariant-skip-pod passed: proof requirement survives skip attempt");
  });

  /**
   * INVARIANT — Wrong owner cannot affect the other party's view
   * Sales completing a logistics-only step (e.g. pack_items_for_shipment) is
   * blocked at the application/API layer, but even if the key appeared in
   * completedStepKeys, sales view would still not render it (not visibleTo sales).
   */
  test("invariant: logistics-internal step recorded does not appear in sales or customer view", () => {
    const completedWithInternalStep = [
      "purchase_order_received",
      "pack_items_for_shipment", // logistics-internal, recorded out of order
    ];
    log("invariant-wrong-owner: completed", completedWithInternalStep);

    // Sales: pack_items_for_shipment not visible to them regardless
    expect(
      viewFor("sales", completedWithInternalStep).map((s) => s.key),
    ).not.toContain("pack_items_for_shipment");

    // Customer: not visible either
    expect(
      viewFor("customer", completedWithInternalStep).map((s) => s.key),
    ).not.toContain("pack_items_for_shipment");

    // Logistics: does see it (and it shows as complete)
    expect(
      viewFor("logistics", completedWithInternalStep).find(
        (s) => s.key === "pack_items_for_shipment",
      )?.completed,
    ).toBe(true);

    log("invariant-wrong-owner passed: cross-party isolation confirmed");
  });
});

# Workflow & UI Discrepancy Tracker

Each issue is numbered. Status: `[ ]` open · `[x]` fixed.

---

## Issue 1 — Doc naming mismatch (Sales states)

**Files:** `SALES_WORKFLOW_MANAGEMENT.md`
**Status:** `[x]`

The doc lists "Partner Handoff Created" and "Partner Fulfillment In Progress" but the code
constant and engine both use "Logistics Handoff Created" and "Logistics Fulfillment In Progress".

**Fix:** Update the doc to match the code.

---

## Issue 2 — "Shipment Created" doesn't match actual DB status

**Files:** `src/constants/sales-workflow-states.ts`, `src/components/ui/workflow-progress.tsx`
**Status:** `[x]`

`SALES_WORKFLOW_STATES` contains `"Shipment Created"` but the engine handler for `order.shipped`
sets the DB status to `"Track Shipment In Transit"`. The `getSalesWorkflowCurrentState` function
papers over this by mapping the DB value back to `"Shipment Created"`, creating a silent
name split across code, DB, and UI.

**Fix:** Rename `"Shipment Created"` → `"Track Shipment In Transit"` in the constant.
Update `getSalesWorkflowCurrentState` to return the new string. Update the `WORKFLOW_ACTION_POINTS`
key to match.

---

## Issue 3 — Double `order.validated` trigger

**Files:** `src/lib/workflow/sales-events.ts`, `src/app/sales/orders/sales-orders-client.tsx`
**Status:** `[x]`

The `order.created` engine handler:

1. Sets order status directly to `"Order Validated"`
2. Auto-queues `order.validated`

The Sales Orders UI also has a manual "Apply Validation Status" button that queues `order.validated`
for the same order. This means every demo-generated order runs `order.validated` twice.

**Fix:** Change `order.created` to set status `"Purchase Order Received"` and remove the
auto-queue of `order.validated`. The UI checkpoint button becomes the single trigger.

---

## Issue 4 — Sales UI fires a logistics-owned event

**Files:** `src/app/sales/orders/sales-orders-client.tsx`
**Status:** `[x]`

Checkpoint 2 "Shipping Doc Gate" in the sales orders panel has a "Move To In Transit" button
that directly dispatches `order.shipped`. `order.shipped` is a logistics-domain event that
transitions the order into `"Track Shipment In Transit"`. This bypasses the logistics workflow
entirely and means both the sales UI and logistics UI can independently push the same order
into transit.

**Fix:** Remove the "Move To In Transit" button from the sales UI. Keep the invoice and
dispatch doc checkboxes as a visual confirmation panel only (no event fired). Only the
logistics UI owns the in-transit transition.

---

## Issue 5 — `order.shipped` auto-queues `order.delivered`, making POD gate inert

**Files:** `src/lib/workflow/logistics-events.ts`, `src/app/logistics/shipments/logistics-shipments-client.tsx`
**Status:** `[x]`

The `order.shipped` engine handler ends with:

```ts
await queueWorkflowEvent("order.delivered", { orderId });
```

This means the moment "Move To In Transit" is clicked, `order.delivered` is automatically
queued and processed before the user can upload a POD document. The logistics UI "Proof of
delivery must be uploaded" guard and "Confirm Delivery" button are therefore dead gates —
the order is already delivered by the time the user interacts.

**Fix:** Remove the auto-queue from the `order.shipped` handler. `order.delivered` must be
triggered explicitly by the logistics "Confirm Delivery" button after POD upload.

---

## Issue 6 — 8 of 11 logistics states have no UI controls or engine handlers

**Files:** `src/constants/logistics-workflow-states.ts`, `src/lib/workflow/logistics-events.ts`,
`src/app/logistics/shipments/logistics-shipments-client.tsx`, `src/lib/workflow/types.ts`
**Status:** `[x]`

`LOGISTICS_WORKFLOW_STATES` defines 11 states. Only 3 have engine event handlers and UI controls:

- `Order Received` ← `logistics.order_received`
- `Track Shipment In Transit` ← `order.shipped`
- `Delivered` ← `order.delivered`

Missing engine + UI coverage for:
| State | Needed Event |
|---|---|
| Order Transmitted to Warehouse | `logistics.warehouse_transmitted` |
| Notify Customer | `logistics.customer_notified` |
| Pack Items for Shipment | `logistics.items_packed` |
| Generate Shipping Label & Documentation | `logistics.shipping_label_generated` |
| Order Arrives at Destination | `logistics.order_arrived` |
| Customer Receives & Signs POD | `logistics.pod_signed` |
| BluBook System Updated | `logistics.system_updated` |

**Fix:** Add all 7 event types to `types.ts`, add handlers to `logistics-events.ts`,
expand logistics UI with a full sequential control panel.

---

## Issue 7 — `logistics.handoff_created` missing from logistics doc event sequence

**Files:** `LOGISTICS_WORKFLOW_MANAGEMENT.md`
**Status:** `[x]`

The Core Event Sequence in the logistics doc lists only 3 events but the engine has 4 handlers
including `logistics.handoff_created` which fires on every sales→logistics handoff.

**Fix:** Add `logistics.handoff_created` as step 1 in the logistics doc event sequence.

---

## Issue 8 — `order.routed` missing from sales doc event sequence

**Files:** `SALES_WORKFLOW_MANAGEMENT.md`
**Status:** `[x]`

`order.routed` is a recognised `SalesWorkflowEventType` with a handler in `sales-events.ts`
(currently a no-op) and is referenced in `isSalesWorkflowEvent`, but it does not appear
anywhere in the `SALES_WORKFLOW_MANAGEMENT.md` event sequence.

**Fix:** Add `order.routed` to the Core Event Sequence in the sales doc with a note that
it is a routing confirmation step (currently a no-op pass-through).

---

## Issue 9 — `WORKFLOW_ACTION_POINTS` uses the stale "Shipment Created" key

**Files:** `src/components/ui/workflow-progress.tsx`
**Status:** `[x]` _(depends on Issue 2)_

`WORKFLOW_ACTION_POINTS.sales` has an entry keyed to `"Shipment Created"` which will become
unreachable after renaming it to `"Track Shipment In Transit"` in Issue 2.

**Fix:** Rename the key in `WORKFLOW_ACTION_POINTS.sales` to `"Track Shipment In Transit"`.
Covered as part of Issue 2 fix.

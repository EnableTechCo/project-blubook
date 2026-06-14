Sales Ops Interaction Required

Purchase Order Received Reason: Sales must explicitly acknowledge PO intake. Order Validated Reason: Sales validation is a business checkpoint and must be explicit. Inventory Reserved Reason: Sales/ops should confirm reservation result before handoff. Logistics Handoff Created Reason: Sales must explicitly assign and hand off to logistics. Invoice Generated Reason: Sales-controlled financial checkpoint. Shipment Created Reason: If this exists in sales pipeline, it should only move after explicit dispatch confirmation from owning team (sales ops or logistics ops, based on your org model). Logistics Interaction Required

Order Received Reason: Logistics acceptance of inbound handoff must be explicit. Order Transmitted to Warehouse Reason: Warehouse transmission should be a confirmed logistics action. Notify Customer Reason: Customer comms should be explicitly executed/recorded. Pack Items for Shipment Reason: Physical packing completion must be confirmed. Generate Shipping Label & Documentation Reason: Compliance docs/labels should be explicit. Track Shipment In Transit Reason: Shipment dispatch/tracking activation should be explicit. Reroute Delivery Reason: Exception workflow requires explicit operator action. Order Arrives at Destination Reason: Arrival confirmation should be explicit (carrier/proof event mapped to logistics action). Customer Receives & Signs POD Reason: POD is a hard interaction checkpoint. BluBook System Updated Reason: Final operational closeout should be explicit. Delivered Reason: Terminal state should only be set by explicit completion action after POD/closeout checks. Should Not Be Auto-Advanced Without Actor Interaction

Logistics Fulfillment In Progress (from sales constants) This should be logistics-owned, not auto-derived from earlier timeline markers. Delivered (in both pipelines) Must remain terminal and interaction-gated.

workflow progress to be fully interaction-driven (no inferred auto-advance), the correct non-flaky count is:

Purchase Order Received (Sales) Order Validated (Sales) Inventory Reserved (Sales) Logistics Handoff Created (Sales) Invoice Generated (Sales) Shipment Created (Sales/Ops owner you define) - should be Sales Order Received (Logistics) Order Transmitted to Warehouse (Logistics) Notify Customer (Logistics) Pack Items for Shipment (Logistics) Generate Shipping Label & Documentation (Logistics) Track Shipment In Transit (Logistics) Reroute Delivery (Logistics exception step) Order Arrives at Destination (Logistics) Customer Receives & Signs POD (Logistics with customer proof) BluBook System Updated (Logistics closeout) Delivered (terminal explicit completion) Breakdown:

Sales-owned interaction steps: 6 Logistics-owned interaction steps: 11 Total: 17

Verified Blockers (Workflow Core)

Step mapper auto-advances to logistics stage from timeline/status inference.
Where: workflow-progress.tsx:532, workflow-progress.tsx:535, workflow-progress.tsx:611, workflow-progress.tsx:614
Problem: If status is Order Received or timeline has logistics_order_received, mapper jumps to stage index 5.
Impact: Earlier steps render complete even if no explicit logistics action happened.
Completion rendering is index-derived, not interaction-derived.
Where: workflow-progress.tsx:401, workflow-progress.tsx:785
Problem: complete = index < clampedIndex.
Impact: Any inferred jump marks multiple prior steps complete.
Partner PO confirm auto-queues and auto-dispatches sales validation.
Where: route.ts:245, route.ts:262
Problem: One confirm action triggers order.validated and immediately drains queue.
Impact: Workflow advances beyond explicit checkpoints.
Customer PO upload auto-drains workflow queue.
Where: route.ts:359
Problem: Queue is processed immediately after upload.
Impact: State changes can happen right after upload without expected human sequencing.
Queue processor is global oldest-first, not order-scoped.
Where: engine.ts:44, engine.ts:45
Problem: Processes any queued event, not just current order context.
Impact: Unrelated queued events can mutate workflow unexpectedly during another flow.
Sales workflow has no formal transition guard framework.
Where: sales-events.ts:83, sales-events.ts:122, sales-events.ts:39
Problem: Unlike logistics, sales events are not uniformly state-guarded.
Impact: Re-entry/replay can progress states when not valid for strict interaction model.
Sales packaging auto-queues logistics order received.
Where: sales-events.ts:578
Problem: order.packaged directly queues logistics.order_received.
Impact: Logistics “received” can become system-driven, not explicit logistics acceptance.
Logistics complete can deliver if required docs config is weak/empty.
Where: route.ts:437, route.ts:489
Problem: If required_documents is empty/misconfigured, completion still queues order.delivered.
Impact: Terminal progression can bypass hard proof gates.
Partner work-orders UI reads wrong timeline key.
Where: partner-work-orders-client.tsx:449, partner-work-orders-client.tsx:515, partner-work-orders-client.tsx:652
Problem: Uses metadata.timeline instead of metadata.workflow_timeline.
Impact: UI falls back to status inference, increasing flakiness/misreporting.
Dashboard mixes multiple recent orders in one progress view context.
Where: page.tsx:459, route.ts:49
Problem: Top 3 recent orders rendered; status checks can be misattributed.
Impact: “Auto-complete” perception worsens if observers don’t pin to one order id.
Permanent, Scalable Core Fix (Not Patchwork)

Create a canonical workflow contract registry.
New core artifact: workflow-step-contract.ts
Fields per step: key, owner (sales or logistics), requiresInteraction, allowedPreviousSteps, proofRequirements, terminal.
Your 17-step model becomes the only source of truth.
Introduce a dedicated step-event ledger table.
Example: order_workflow_step_events(order_id, step_key, actor_type, actor_id, source, created_at, metadata).
UI completion derives from persisted events, not inferred status/timeline strings.
Enforce transition guards centrally for both sales and logistics.
One shared validator called by all handlers before state mutation.
Reject transition if owner mismatch, prerequisite step missing, or proof missing.
Remove implicit auto-advance from upload/confirm endpoints.
Keep upload as Purchase Order Received.
Keep sales confirm as explicit single-step write.
Move dispatch to explicit operator actions or controlled workflow orchestrator with per-order scope.
Make delivery terminal strictly proof-gated.
Delivered only if Customer Receives & Signs POD event exists and required docs verified.
No direct queue of order.delivered from “complete” unless prerequisites satisfied.
Replace UI inference with event-driven progress.
workflow-progress.tsx should consume ordered completed step events.
complete should be based on event existence for each step, not index < currentIndex.
Normalize API payloads to expose workflow_timeline consistently.
Fix partner work-orders client key mismatch.
Prefer explicit completedSteps list from API to avoid client-side inference drift.
Add invariant tests at logic layer (no browser dependency).
Must assert forbidden auto-advances:
upload does not produce logistics-owned completed steps
sales validation does not mark logistics acceptance
delivered forbidden without POD event
wrong owner action rejected

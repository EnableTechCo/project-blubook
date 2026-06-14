# Workflow UI/Flow Discrepancy Audit

Date: 2026-06-13
Scope: Production workflow behavior and UI flow only. Tests intentionally excluded.

## Required Findings (Added As Requested)

1. Partner PO confirm still auto-queues and drains `order.validated` in handoff path.
   Evidence: [src/app/api/partner/purchase-orders/confirm/route.ts#L420](src/app/api/partner/purchase-orders/confirm/route.ts#L420), [src/app/api/partner/purchase-orders/confirm/route.ts#L425](src/app/api/partner/purchase-orders/confirm/route.ts#L425), [src/app/api/partner/purchase-orders/confirm/route.ts#L429](src/app/api/partner/purchase-orders/confirm/route.ts#L429)
   Impact: One confirmation action advances beyond explicit sales checkpoint.

2. Queue processor is still global oldest-first, not order-scoped.
   Evidence: [src/lib/workflow/engine.ts#L36](src/lib/workflow/engine.ts#L36)
   Impact: Queued events from unrelated orders can be processed in the same dispatch cycle.

3. Progress inference still exists and is used in partner surfaces.
   Evidence: [src/components/ui/workflow-progress.tsx#L666](src/components/ui/workflow-progress.tsx#L666), [src/app/partner/dashboard/page.tsx#L1095](src/app/partner/dashboard/page.tsx#L1095), [src/app/partner/work-orders/partner-work-orders-client.tsx#L445](src/app/partner/work-orders/partner-work-orders-client.tsx#L445)
   Impact: Completion/progress can still be inferred from status/timeline instead of explicit event ledger only.

4. Dashboard still mixes multiple recent orders via top-3 slices.
   Evidence: [src/app/api/partner/dashboard/route.ts#L1138](src/app/api/partner/dashboard/route.ts#L1138), [src/app/api/partner/dashboard/route.ts#L1154](src/app/api/partner/dashboard/route.ts#L1154)
   Impact: Users can perceive cross-order progression noise in one screen context.

5. Delivered is still queued from complete action without explicit POD-step event verification at queue decision point.
   Evidence: [src/app/api/partner/work-orders/route.ts#L526](src/app/api/partner/work-orders/route.ts#L526)
   Impact: Terminal transition remains dependent on docs checks plus downstream status guard, not a direct step-event prerequisite assertion before queuing.

6. Transition guard is centralized but status-based only; it does not enforce contract owner/prerequisite/proof requirements.
   Evidence: [src/lib/workflow/transition-validator.ts#L11](src/lib/workflow/transition-validator.ts#L11)
   Impact: Guard does not yet validate full 17-step contract semantics.

## Additional UI/Flow Discrepancies

1. Duplicate action surfaces for the same state transitions in work-orders UI.
   Evidence: Banner actions and table actions both call same backend actions in [src/app/partner/work-orders/partner-work-orders-client.tsx#L388](src/app/partner/work-orders/partner-work-orders-client.tsx#L388), [src/app/partner/work-orders/partner-work-orders-client.tsx#L530](src/app/partner/work-orders/partner-work-orders-client.tsx#L530), [src/app/partner/work-orders/partner-work-orders-client.tsx#L417](src/app/partner/work-orders/partner-work-orders-client.tsx#L417), [src/app/partner/work-orders/partner-work-orders-client.tsx#L556](src/app/partner/work-orders/partner-work-orders-client.tsx#L556)
   Impact: DRY violation in user flow. User can be asked to perform effectively same transition from multiple widgets.

2. Action naming is semantically confusing: complete vs deliver.
   Evidence: UI action payload uses `action: "complete"` while label renders delivered wording via `WORKFLOW_ACTION_LABELS.logisticsDeliver` in [src/app/partner/work-orders/partner-work-orders-client.tsx#L570](src/app/partner/work-orders/partner-work-orders-client.tsx#L570), [src/app/partner/work-orders/partner-work-orders-client.tsx#L574](src/app/partner/work-orders/partner-work-orders-client.tsx#L574), [src/constants/workflow-stage-labels.ts#L58](src/constants/workflow-stage-labels.ts#L58)
   Impact: Operator sees delivery-language while backend transition is complete-action + queued terminal event.

3. Work-orders banner is itself top-3 limited, adding more context loss.
   Evidence: [src/app/partner/work-orders/partner-work-orders-client.tsx#L360](src/app/partner/work-orders/partner-work-orders-client.tsx#L360)
   Impact: Important active items can be hidden from primary interaction zone.

4. Step-inputs model exists in DB and contract, but no UI/API path currently writes `order_workflow_step_inputs`.
   Evidence: Step-input table definition [supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L6](supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L6), rich input contract fields like inventory data [src/lib/workflow/workflow-step-contract.ts#L129](src/lib/workflow/workflow-step-contract.ts#L129), no usage match in `src/**` for `order_workflow_step_inputs`.
   Impact: Realistic per-step operational data collection is not wired, so steps with required operational details (for example inventory reservation specifics) cannot be captured natively in current flow.

5. Partner UI still computes progress index from status/timeline instead of step-event list.
   Evidence: [src/app/partner/work-orders/partner-work-orders-client.tsx#L445](src/app/partner/work-orders/partner-work-orders-client.tsx#L445), [src/app/partner/work-orders/partner-work-orders-client.tsx#L509](src/app/partner/work-orders/partner-work-orders-client.tsx#L509), [src/app/partner/work-orders/partner-work-orders-client.tsx#L646](src/app/partner/work-orders/partner-work-orders-client.tsx#L646)
   Impact: “Flow-driven, queue-driven, explicit-interaction” behavior is partially undermined in partner presentation layer.

## What Is Already Correct (For Context)

1. Customer PO upload does not auto-drain.
   Evidence: [src/app/api/customer/workflow/po-uploaded/route.ts#L359](src/app/api/customer/workflow/po-uploaded/route.ts#L359)

2. Sales packaging no longer auto-queues logistics receive.
   Evidence: [src/lib/workflow/sales-events.ts#L578](src/lib/workflow/sales-events.ts#L578)

3. Partner work-orders uses `workflow_timeline` key, not `metadata.timeline`.
   Evidence: [src/app/partner/work-orders/partner-work-orders-client.tsx#L445](src/app/partner/work-orders/partner-work-orders-client.tsx#L445)

## Customer Dashboard Audit (Appended)

1. Customer dashboard progress widgets are event-driven (good), but owner/next messaging remains status-mapped inference.
   Evidence: Event-driven progress usage at [src/app/customer/dashboard/page.tsx#L643](src/app/customer/dashboard/page.tsx#L643) and [src/app/customer/dashboard/page.tsx#L648](src/app/customer/dashboard/page.tsx#L648); status-mapped owner messaging at [src/app/customer/dashboard/page.tsx#L560](src/app/customer/dashboard/page.tsx#L560).
   Impact: Main progress bar/matrix is interaction-driven, but contextual owner text can drift from strict event-ledger truth.

2. Customer dashboard intentionally pins to one order for progress (most recent active), reducing mixed-order confusion.
   Evidence: [src/app/customer/dashboard/page.tsx#L102](src/app/customer/dashboard/page.tsx#L102), [src/app/customer/dashboard/page.tsx#L534](src/app/customer/dashboard/page.tsx#L534).
   Impact: Better than partner top-3 rendering for workflow context integrity.

3. Step-events API currently lacks explicit per-order authorization checks beyond "authenticated session".
   Evidence: [src/app/api/orders/[orderId]/step-events/route.ts#L40](src/app/api/orders/[orderId]/step-events/route.ts#L40).
   Impact: If no external guard blocks it, authenticated users could query/post events for unrelated order IDs.

4. Customer orders API normalizes and returns `workflow_timeline` consistently.
   Evidence: [src/app/api/customer/orders/route.ts#L52](src/app/api/customer/orders/route.ts#L52).
   Impact: Timeline key consistency is correct on the customer side.

## Thorough Audit - Pass 2 (Non-Test, System-Wide)

Scope note: This pass intentionally excludes test quality and deep step-by-step invariant test coverage.

### Critical Findings

1. Step-events API allows actor-type spoofing from request body.
   Evidence: `actorType` is accepted directly from client payload in [src/app/api/orders/[orderId]/step-events/route.ts#L101](src/app/api/orders/[orderId]/step-events/route.ts#L101) and passed to recorder in [src/app/api/orders/[orderId]/step-events/route.ts#L126](src/app/api/orders/[orderId]/step-events/route.ts#L126).
   Impact: A caller can submit events as `sales`, `logistics`, `staff`, etc. without server-side derivation from authenticated role.

2. Step-events API lacks explicit order ownership/role authorization checks.
   Evidence: endpoint checks only authenticated user in [src/app/api/orders/[orderId]/step-events/route.ts#L40](src/app/api/orders/[orderId]/step-events/route.ts#L40) and [src/app/api/orders/[orderId]/step-events/route.ts#L89](src/app/api/orders/[orderId]/step-events/route.ts#L89), with no org/order permission filter.
   Impact: Authenticated users may query/post events for unrelated order IDs if not blocked elsewhere.

3. RLS policies for workflow event/input writes are permissive (`with check (true)` / `using (true)`).
   Evidence: events insert policy in [supabase/migrations/20260612000000_order_workflow_step_events.sql#L76](supabase/migrations/20260612000000_order_workflow_step_events.sql#L76); inputs insert/update policies in [supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L66](supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L66) and [supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L71](supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L71).
   Impact: Policy semantics do not independently enforce service-role-only writes. Safety depends on grants/client usage outside policy logic.

### High Findings

1. Global client fetch monkey-patch logs users out on any 401 while on protected paths.
   Evidence: [src/components/providers/app-providers.tsx#L37](src/components/providers/app-providers.tsx#L37) to [src/components/providers/app-providers.tsx#L59](src/components/providers/app-providers.tsx#L59).
   Impact: Any non-session 401 (including unrelated calls) can trigger sign-out + redirect. This is broad and can produce false-positive logout events.

2. Middleware treats several protected portal roots as public routes.
   Evidence: public routes include `/partner`, `/staff`, `/admin`, `/sales`, `/logistics` in [src/lib/supabase/middleware.ts#L13](src/lib/supabase/middleware.ts#L13).
   Impact: Top-layer auth gate is deferred to layout guards; middleware-level protection is inconsistent for those roots.

3. Dev auth bypass defaults to enabled in non-production unless explicitly disabled.
   Evidence: [src/lib/supabase/middleware.ts#L31](src/lib/supabase/middleware.ts#L31) and bypass return in [src/lib/supabase/middleware.ts#L46](src/lib/supabase/middleware.ts#L46).
   Impact: Easy to run with effectively open auth in shared dev/staging-like environments if envs are misconfigured.

4. Role mismatch still routes to unauthorized page rather than logout.
   Evidence: [src/lib/auth/require-route-access.ts#L92](src/lib/auth/require-route-access.ts#L92).
   Impact: Conflicts with strict “invalidate session and return to login” expectation for all inaccessible dashboard paths.

### Medium Findings

1. Partner dashboard error handling still collapses auth failures into generic in-page error states.
   Evidence: [src/app/partner/dashboard/page.tsx#L163](src/app/partner/dashboard/page.tsx#L163), [src/app/partner/dashboard/page.tsx#L329](src/app/partner/dashboard/page.tsx#L329).
   Impact: Session/permission issues may present as generic load errors before global 401 logic takes over.

2. Partner work-orders UI still has duplicated action entry points (banner + table) for same backend actions.
   Evidence: [src/app/partner/work-orders/partner-work-orders-client.tsx#L388](src/app/partner/work-orders/partner-work-orders-client.tsx#L388) and [src/app/partner/work-orders/partner-work-orders-client.tsx#L530](src/app/partner/work-orders/partner-work-orders-client.tsx#L530).
   Impact: Operator flow is noisy and can feel like repeating the same action in different surfaces.

3. Step-input data model remains unimplemented in app flows.
   Evidence: input schema exists in [supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L6](supabase/migrations/20260612000001_order_workflow_step_inputs.sql#L6), but no `order_workflow_step_inputs` usage in app code scan.
   Impact: Operationally important fields (for example inventory reservation details) are not captured despite contract support.

### Confirmed Improvements (Already In Place)

1. Partner route now has top-layer role guard.
   Evidence: [src/app/partner/layout.tsx#L8](src/app/partner/layout.tsx#L8).

2. Customer and sales layouts enforce role guards.
   Evidence: [src/app/customer/layout.tsx#L8](src/app/customer/layout.tsx#L8), [src/app/sales/layout.tsx#L8](src/app/sales/layout.tsx#L8).

3. Global 401 session-expiry redirect UX is implemented.
   Evidence: [src/components/providers/app-providers.tsx#L57](src/components/providers/app-providers.tsx#L57).

## Implementation Checklist (Prioritized, Same File)

### P0 - Security/Integrity (Do First)

1. Enforce per-order authorization on step-events API.
   Files: [src/app/api/orders/[orderId]/step-events/route.ts](src/app/api/orders/[orderId]/step-events/route.ts)
   Change:
   - On GET and POST, verify authenticated user can access the order through organization ownership + role rules.
   - Reject unauthorized order IDs with 403.
     Acceptance:
   - Authenticated user cannot read/write step events for orders outside their organization/role scope.

2. Remove client-controlled actorType trust.
   Files: [src/app/api/orders/[orderId]/step-events/route.ts](src/app/api/orders/[orderId]/step-events/route.ts), [src/app/api/auth/context/route.ts](src/app/api/auth/context/route.ts)
   Change:
   - Derive actor type server-side from resolved role/profile.
   - Ignore client-sent actorType except possibly for `system` routes not user-invoked.
     Acceptance:
   - Client cannot spoof `sales`/`logistics`/`staff` actor types.

3. Tighten RLS write policies for workflow ledgers.
   Files: [supabase/migrations/20260612000000_order_workflow_step_events.sql](supabase/migrations/20260612000000_order_workflow_step_events.sql), [supabase/migrations/20260612000001_order_workflow_step_inputs.sql](supabase/migrations/20260612000001_order_workflow_step_inputs.sql)
   Change:
   - Replace permissive write policy predicates with explicit role-bound checks or remove user write paths entirely and keep service-only write channel.
     Acceptance:
   - Non-service callers cannot insert/update workflow event/input rows.

### P1 - Workflow Correctness

1. Remove auto-queue + auto-drain from partner PO handoff confirm path.
   Files: [src/app/api/partner/purchase-orders/confirm/route.ts](src/app/api/partner/purchase-orders/confirm/route.ts)
   Change:
   - Stop queuing `order.validated` and stop calling `drainWorkflowQueue` in handoff branch.
   - Keep handoff confirm as explicit single-step write + notifications.
     Acceptance:
   - Confirm action does not advance sales validation automatically.

2. Stop queueing terminal delivery without explicit step-event prerequisite checks.
   Files: [src/app/api/partner/work-orders/route.ts](src/app/api/partner/work-orders/route.ts), [src/services/workflow-step-events.service.ts](src/services/workflow-step-events.service.ts)
   Change:
   - Before queueing `order.delivered`, require explicit completed step events for `customer_receives_signs_pod` and `blubook_system_updated`.
     Acceptance:
   - Complete action fails with clear error unless required terminal prerequisites are present.

3. Move transition validation from status-only to contract-aware checks.
   Files: [src/lib/workflow/transition-validator.ts](src/lib/workflow/transition-validator.ts), [src/lib/workflow/workflow-step-contract.ts](src/lib/workflow/workflow-step-contract.ts)
   Change:
   - Validate owner, allowed previous steps, and proof requirements per contract before mutation.
     Acceptance:
   - Invalid owner action and missing prerequisite/proof are rejected centrally.

### P2 - UX Flow and Operator Clarity

1. Remove duplicated action surfaces in partner work-orders.
   Files: [src/app/partner/work-orders/partner-work-orders-client.tsx](src/app/partner/work-orders/partner-work-orders-client.tsx)
   Change:
   - Keep one canonical action rail per work order.
   - Avoid banner + table both exposing identical state transitions.
     Acceptance:
   - Operator has one clear action path for each step.

2. Replace misleading action labels (`complete` vs `deliver`) with explicit operational step names.
   Files: [src/constants/workflow-stage-labels.ts](src/constants/workflow-stage-labels.ts), [src/app/partner/work-orders/partner-work-orders-client.tsx](src/app/partner/work-orders/partner-work-orders-client.tsx)
   Change:
   - Align button labels to actual required action for current step.
   - Remove terminology that implies terminal delivery when step is non-terminal completion.
     Acceptance:
   - Labels map 1:1 to backend action semantics.

3. Replace top-3 recent slices with single pinned workflow context + explicit switcher.
   Files: [src/app/api/partner/dashboard/route.ts](src/app/api/partner/dashboard/route.ts), [src/app/partner/dashboard/page.tsx](src/app/partner/dashboard/page.tsx)
   Change:
   - Return one active workflow context for main progress panel.
   - Provide separate list for additional orders without blending context.
     Acceptance:
   - Main progress view never mixes multiple orders.

### P3 - Step Input Capture (Operational Depth)

1. Implement step-input write/read path for contract-defined fields.
   Files: [src/app/api/orders/[orderId]/step-events/route.ts](src/app/api/orders/[orderId]/step-events/route.ts), new API route for step inputs, [src/services/workflow-step-events.service.ts](src/services/workflow-step-events.service.ts)
   Change:
   - Persist `input_data` into `order_workflow_step_inputs` per step.
   - Validate payload keys against `inputFields` from contract.
     Acceptance:
   - Steps like `inventory_reserved` require and persist warehouse, quantity, backorder, hold duration, etc.

2. Add step-specific UI forms where required by contract.
   Files: [src/app/partner/work-orders/partner-work-orders-client.tsx](src/app/partner/work-orders/partner-work-orders-client.tsx), [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx), [src/app/customer/dashboard/page.tsx](src/app/customer/dashboard/page.tsx)
   Change:
   - Replace pure click-through transitions with required data-entry forms for applicable steps.
     Acceptance:
   - User cannot advance step that needs structured input without completing required fields.

### P4 - Session/Auth UX Consistency

1. Narrow global 401 logout trigger to auth/session failures only.
   Files: [src/components/providers/app-providers.tsx](src/components/providers/app-providers.tsx)
   Change:
   - Gate logout flow to known auth endpoints or known auth error signatures.
   - Avoid logging out on unrelated 401s.
     Acceptance:
   - Session expiry still logs out immediately, but unrelated API 401s do not force logout.

2. Reconcile middleware public route list with route-layout guards.
   Files: [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts)
   Change:
   - Remove protected portal roots from public routes or document intentional split explicitly.
     Acceptance:
   - Top-layer auth model is consistent and unsurprising.

## Live TODO (Execution In Progress)

- [x] Create consolidated implementation TODO list in this audit file.
- [x] P0.1 Harden [src/app/api/orders/[orderId]/step-events/route.ts](src/app/api/orders/[orderId]/step-events/route.ts) with per-order authorization checks.
- [x] P0.2 Remove client-provided `actorType` trust in [src/app/api/orders/[orderId]/step-events/route.ts](src/app/api/orders/[orderId]/step-events/route.ts).
- [x] P0.3 Validate compile/lint errors for modified files.
- [x] P0.4 Update this TODO block with completed statuses after code patch.
- [x] P0.5 Harden workflow ledger write RLS via [supabase/migrations/20260613000000_harden_workflow_ledger_write_rls.sql](supabase/migrations/20260613000000_harden_workflow_ledger_write_rls.sql).
- [x] P1.1 Remove partner PO confirm auto-queue and auto-drain in [src/app/api/partner/purchase-orders/confirm/route.ts](src/app/api/partner/purchase-orders/confirm/route.ts).
- [x] P1.2 Require explicit POD + system-update step events before queueing delivery in [src/app/api/partner/work-orders/route.ts](src/app/api/partner/work-orders/route.ts).
- [x] P1.3 Harden [src/lib/workflow/transition-validator.ts](src/lib/workflow/transition-validator.ts) with contract owner/prerequisite/proof checks (with legacy no-step-events compatibility bridge).
- [x] P2.1 Remove duplicate banner/table action rails in [src/app/partner/work-orders/partner-work-orders-client.tsx](src/app/partner/work-orders/partner-work-orders-client.tsx) by keeping actions only in the table.
- [x] P2.2 Align completion wording in [src/constants/workflow-stage-labels.ts](src/constants/workflow-stage-labels.ts) and partner work-orders UI to avoid complete-vs-deliver ambiguity.
- [x] P2.3 Pin partner dashboard primary workflow context to one active order/handoff in [src/app/api/partner/dashboard/route.ts](src/app/api/partner/dashboard/route.ts) (with `additionalRecent` provided separately).
- [x] P4.2 Reconcile middleware protected-route behavior in [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts).
- [x] P4.1 Narrow 401-triggered forced logout logic in [src/components/providers/app-providers.tsx](src/components/providers/app-providers.tsx).

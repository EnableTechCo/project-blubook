# Admin Dashboard Specification (Full Operations Oversight)

## Objective

Build a full-fledged Admin Dashboard that gives admins a single control surface to oversee all operations across customers, partners, orders, and workflow execution.

This dashboard should support both:

- Operational command (monitoring and intervention)
- Administrative control (partner/customer lifecycle management)

## Core Requirement Summary

The immediate priority features are:

1. Orders tab: Track all system work orders and purchase orders, with active/current and completed views.
2. Partners tab: View all partners and activity, with create/edit/delete partner management.
3. Customers tab: View all system customers and activity.

## Phase 1 Live Implementation Tracker

Status legend:

- [ ] Not started
- [~] In progress
- [x] Implemented

Database-driven rule for Phase 1:

- Every shipped view must read from Supabase-backed tables and existing server routes.
- No hardcoded operational metrics or fake list rows.

Checklist:

- [x] Phase 1A: Overview tab uses database-backed KPI metrics and alerts.
- [x] Phase 1B: Orders tab is available in admin sidebar and loads all-system orders from server route.
- [x] Phase 1C: Partners tab is available in admin sidebar with create/edit/delete backed by `service_partners`.
- [x] Phase 1D: Customers tab is available in admin sidebar and loads all-system customer activity from database.
- [x] Phase 1E: Dispatch Queue lite tab is available in admin sidebar and loads `workflow_events_queue` status.
- [x] Phase 1F: Role guard and API guard validation for all new Phase 1 surfaces.
- [~] Phase 1G: Phase 1 smoke test pass (lint/typecheck + targeted route/page checks).

Realtime implementation notes:

- Started now: adding Phase 1 inline tracker and beginning implementation in this order: Orders -> Partners -> Customers -> Dispatch Queue -> validation.
- Implemented: admin sidebar entries for Orders, Partners, Customers, Dispatch Queue.
- Implemented: Orders tab page (`src/app/admin/orders/page.tsx`) using `/api/system/workflow/orders`.
- Implemented: Customers API (`src/app/api/admin/customers/route.ts`) + Customers tab (`src/app/admin/customers/page.tsx`).
- Implemented: Dispatch Queue API (`src/app/api/admin/dispatch-queue/route.ts`) + Dispatch Queue tab (`src/app/admin/dispatch-queue/page.tsx`).
- Implemented: Partners modal flow (Add Partner modal, Edit Partner modal, Delete confirmation) on `src/app/admin/partners/page.tsx`.
- Implemented: Overview metrics API (`src/app/api/admin/overview-metrics/route.ts`) and dashboard KPI/alerts integration in `src/app/admin/dashboard/page.tsx`.
- Validation update: lint clean, typecheck clean, and no diagnostics across all newly added Phase 1 files.

## Phase 2 Live Implementation Tracker

Status legend:

- [ ] Not started
- [~] In progress
- [x] Implemented

Database-driven rule for Phase 2:

- Every shipped view must query real Supabase-backed tables through protected admin APIs.
- No static mock operational rows for dashboard reporting.

Checklist:

- [x] Phase 2A: Work Orders tab and `/api/admin/work-orders` route implemented.
- [x] Phase 2B: Logistics Handoffs tab and `/api/admin/logistics-handoffs` route implemented.
- [x] Phase 2C: Sales Pipeline tab and `/api/admin/sales-pipeline` route implemented.
- [x] Phase 2D: Admin sidebar updated to include Work Orders, Logistics Handoffs and Sales Pipeline.
- [x] Phase 2E: Admin API smoke tests added for all three new Phase 2 routes.
- [x] Phase 2F: Documents tab (`src/app/admin/documents/page.tsx`) + `/api/admin/documents` route implemented.
- [x] Phase 2G: Users & Roles page replaced with DB-backed roster from `user_profiles` + `/api/admin/users-roster`; role distribution and 30d active metrics added.
- [~] Phase 2H: Smoke validation run (lint/typecheck/tests) pending manual command approval.

## Data Model Grounding (Current System)

Use existing system tables and role model as source of truth.

Primary entities for this dashboard:

- organizations: multi-tenant org records (kind includes customer, partner, admin)
- organization_memberships: user-to-org role membership
- user_profiles: user role and org context
- sales_orders: order lifecycle and status
- work_orders: production/fulfillment work units
- provider_workflow_handoffs: cross-provider logistics and handoff execution
- sales_partner_handoffs: order item handoffs to partners
- service_partners: provider registry (operational partner catalog)

Important note for Partners:

- Partner account/identity context is organization-based (organizations with kind=partner).
- Operational provider catalog is also represented in service_partners.
- The Admin Partners tab should define one canonical source for CRUD (recommended: organizations(kind=partner) for account identity, with linked service_partners where needed for stream/site operations).

## Information Architecture (Admin Sidebar)

Recommended sidebar structure:

- Overview
- Orders
- Partners
- Customers
- Work Orders
- Logistics Handoffs
- Sales Pipeline
- Workflows
- Dispatch Queue
- Documents
- Billing
- Notifications
- Users & Roles
- Audit & Compliance
- Integrations
- AI Insights
- Settings

## Feature Ladder (Simple to Complex)

### Level 1: Foundational (Simple)

1. Global KPI strip

- Total active orders
- Completed orders (today/7d)
- Active partners
- Active customers
- SLA at risk count

2. Global search + filters

- Search by order ID, PO reference, customer/partner name, status
- Filter by date, status, organization, package stream

3. Read-only operations visibility

- Unified list views for orders, partners, customers
- Sort, pagination, export CSV

### Level 2: Operational Control (Medium)

1. Orders tab (required)

- System-wide order board/list with tabs:
  - Active/Current
  - Completed
  - At Risk
- Track both purchase-order-derived sales orders and work orders.
- Reuse customer/partner tracking patterns where possible:
  - status chips
  - timeline/progress
  - detail drawer/panel

2. Partners tab (required)

- System-wide partner directory and activity summary
- Add Partner button (top-right, aligned with existing Add Purchase Order placement pattern)
- Add partner modal form:
  - validate input
  - submit POST
  - confirmation toast/state on success
- Edit partner flow
- Delete partner flow with confirmation guard
- Show partner activity:
  - assigned handoffs
  - open/completed work volume
  - recent execution timestamps

3. Customers tab (required)

- System-wide customer directory and activity summary
- Customer cards/rows include:
  - active orders
  - completed orders
  - pending requirements
  - subscription/package context (if applicable)

4. Detail drill-down

- Click-through details for any order/customer/partner
- Side panel with linked records and latest events

### Level 3: Governance and Exceptions (Advanced)

1. Exception inbox

- Failed workflow events
- Stale handoffs
- SLA breaches and near-breach warnings

2. Audit timeline

- Operational actions with actor, entity, before/after state
- Filter by user, action, date range

3. Queue control center

- workflow_events_queue visibility
- replay/retry failed events
- bulk retry with guardrails

4. Role-safe intervention actions

- reassign handoff
- force status reconciliation path
- reopen/close issue workflows

### Level 4: Intelligence and Automation (Complex)

1. Predictive risk scoring

- Detect likely delayed orders based on current state and historical lead times

2. Capacity and partner load balancing

- Recommend partner routing based on stream performance and backlog

3. AI-assisted anomaly center

- Outlier detection on order transitions and operational behavior
- Recommended interventions with confidence and rationale

4. Executive analytics

- Cohort trends, throughput, SLA performance, partner scorecards

## Full Tab Specifications (Simple to Complex)

### 1) Overview Tab

Purpose:

- Give leadership and operators a one-screen status pulse.

Simple features:

- KPI strip for active orders, completed today, SLA risk, failed events, open escalations.
- Quick filters for Today, 7d, 30d.

Advanced features:

- Multi-panel trend widgets.
- Configurable dashboard cards and saved layouts per admin.

### 2) Orders Tab (Required)

Purpose:

- Track all system purchase-order-derived orders and current order lifecycle state.

Simple features:

- Active, Completed, At Risk views.
- Search by order ID, PO reference, customer, partner, status.

Advanced features:

- Split view: table + timeline panel.
- Bulk actions (export, assign reviewer, trigger follow-up workflow).

Data sources:

- sales_orders
- sales_order_items
- order_workflow_step_events

### 3) Work Orders Tab

Purpose:

- Track internal fulfillment work units independently from top-level order records.

Simple features:

- Queue by status and age.
- Assignee/site columns.

Advanced features:

- Capacity heatmap and bottleneck detector.
- Workload balancing recommendations.

Data sources:

- work_orders
- sales_order_items

### 4) Logistics Handoffs Tab

Purpose:

- Monitor provider handoff flow and detect stalled transitions.

Simple features:

- List of open handoffs and current handoff status.
- Filter by provider and package stream.

Advanced features:

- Handoff chain visualization and replay.
- Auto-escalation rules for stale handoffs.

Data sources:

- provider_workflow_handoffs
- sales_partner_handoffs

### 5) Partners Tab (Required)

Purpose:

- Manage and monitor all partners across the system.

Simple features:

- System-wide partner directory with activity metrics.
- Add Partner button on top-right, same placement pattern as customer Add Purchase Order action.

Create partner flow:

1. Click Add Partner.
2. Open form modal.
3. Validate required fields.
4. Submit POST request.
5. Show success confirmation and refresh list.

Edit partner flow:

- Open prefilled modal.
- PATCH/PUT update.
- Confirmation and refreshed data.

Delete partner flow:

- Confirmation dialog.
- Soft delete or status inactive.
- Refresh list and show toast.

Advanced features:

- Partner scorecard (acceptance SLA, completion rate, response time).
- Contract and compliance flags.

Data model note:

- Partner identity should be represented in organizations with kind=partner.
- Operational partner registry can be linked with service_partners where stream-level capability is required.

### 6) Customers Tab (Required)

Purpose:

- Provide system-wide customer visibility and operational activity.

Simple features:

- Customer directory with active/completed order counts and recent activity.
- Filter by status, package, geography, volume tier.

Advanced features:

- Customer health score and risk trend.
- Revenue and support burden overlays.

Data sources:

- organizations with kind=customer
- user_profiles
- organization_memberships
- sales_orders
- subscriptions
- invoices

### 7) Sales Pipeline Tab

Purpose:

- Monitor progression from PO intake to validated and reserved states.

Simple features:

- Stage funnel with counts and conversion.
- Stale stage detector.

Advanced features:

- Forecast of expected throughput.
- Stage-level anomaly detection.

### 8) Workflows Tab

Purpose:

- Control and inspect state-machine transitions across all operational streams.

Simple features:

- Workflow status explorer by order.
- Step event timeline.

Advanced features:

- Manual transition tooling with guardrails.
- Transition policy simulator for change planning.

Data sources:

- order_workflow_step_events
- order_workflow_step_inputs
- workflow_events_queue

### 9) Dispatch Queue Tab

Purpose:

- Operate asynchronous workflow event processing centrally.

Simple features:

- Queue list with queued, processing, completed, failed statuses.
- Retry failed events.

Advanced features:

- Bulk retry with safety checks.
- Dead-letter lane and replay diagnostics.

Data sources:

- workflow_events_queue

### 10) Documents Tab

Purpose:

- Audit and manage required workflow evidence and uploaded files.

Simple features:

- Document list by order/customer/partner.
- Missing-required-document indicator.

Advanced features:

- Document SLA monitoring.
- Automated evidence completeness checks.

### 11) Billing Tab

Purpose:

- Give admin visibility into subscription and invoice operations.

Simple features:

- Customer subscription statuses.
- Invoice lifecycle tracker.

Advanced features:

- Dunning and payment risk panel.
- Revenue leakage alerts.

Data sources:

- subscriptions
- invoices
- invoice_line_items

### 12) Notifications Tab

Purpose:

- Monitor outbound communication health and delivery status.

Simple features:

- Email queue and delivery state list.
- Failure and retry counts.

Advanced features:

- Template-level delivery analytics.
- Channel performance diagnostics.

Data sources:

- outbound_emails

### 13) Users And Roles Tab

Purpose:

- Control user access, role distribution, and cross-org memberships.

Simple features:

- User list with role and membership status.
- Role filter and invite resend actions.

Advanced features:

- Role drift detection.
- Access review workflow and attestation.

Data sources:

- user_profiles
- organization_memberships

### 14) Audit And Compliance Tab

Purpose:

- Provide immutable visibility for sensitive operational actions.

Simple features:

- Searchable action log with actor and timestamp.
- Filters for entity type and action.

Advanced features:

- Compliance export packs.
- Alerting for privileged or anomalous admin actions.

### 15) Integrations Tab

Purpose:

- Observe integration health across email, workflow hooks, and external systems.

Simple features:

- Integration status list and last sync timestamp.

Advanced features:

- Circuit breaker controls and failover routing.

### 16) AI Insights Tab

Purpose:

- Surface model-driven recommendations for risk, routing, and anomaly triage.

Simple features:

- Ranked anomaly list with confidence scores.

Advanced features:

- What-if controls and recommendation acceptance pipeline.

## Immediate Delivery Scope (Phase 1)

1. Overview tab with KPI strip and alert cards.
2. Orders tab with active/completed/at-risk segmentation.
3. Partners tab with create/edit/delete modal flow.
4. Customers tab with system-wide list and activity summary.
5. Dispatch Queue lite view for failed event visibility.

## Phase 2 Scope

1. Work Orders tab.
2. Logistics Handoffs tab.
3. Sales Pipeline tab.
4. Documents tab.
5. Users and Roles enhancements.

## Phase 3 Scope

1. Billing tab.
2. Audit and Compliance expansion.
3. Integrations tab.
4. AI Insights tab.

## Component Reuse Guidance

Leverage existing patterns/components from customer and partner dashboards where possible:

- order status badges
- order list/detail interaction model
- loading/empty/error states
- modal behavior and form controls

Reuse first, then extend for system-wide scope.

## API Contract Recommendations

### Orders

- GET /api/admin/orders
  - query: status, organizationId, partnerId, dateFrom, dateTo, search, page, pageSize
  - returns aggregated order + work-order activity rows

### Partners

- GET /api/admin/partners
- POST /api/admin/partners
- PATCH /api/admin/partners/:id
- DELETE /api/admin/partners/:id

### Customers

- GET /api/admin/customers
- GET /api/admin/customers/:id/activity

### Security

- Admin-only access via role checks
- Return normalized error envelopes
- Audit all create/update/delete operations

## Non-Functional Requirements

- Performance: list views should support pagination and indexed filters
- Reliability: retries and robust error messaging on all mutations
- Observability: action logging, API latency monitoring, failure metrics
- Accessibility: keyboard-navigable grids, semantic form labels, focus management in modals

## Rollout Plan

### Phase 1 (MVP)

- Orders tab (active/completed)
- Partners tab (list + create)
- Customers tab (list + summary)

### Phase 2

- Partners edit/delete
- Advanced filters and saved views
- Customer/partner detail drill-downs

### Phase 3

- Exception inbox
- Queue controls
- SLA and anomaly monitoring

### Phase 4

- Predictive insights
- Intelligent routing recommendations
- Executive reporting suite

## Acceptance Criteria (Immediate)

1. Admin can view all active and completed orders system-wide.
2. Admin can create a partner through Add Partner modal and receive success confirmation.
3. Admin can edit and delete partner records.
4. Admin can view all customers and their activity summaries.
5. Views load with clear empty/error states and server-driven pagination.

## Out of Scope (Current Scope Guard)

- Rebuilding customer or partner dashboards from scratch
- Introducing new role classes beyond existing role model
- Full BI warehouse/reporting implementation in initial release

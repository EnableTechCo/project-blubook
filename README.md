# BluBook

BluBook is a multi-role operations platform used to move customer work from request to delivery.

It has separate portals for:

- Customer
- Partner
- Sales
- Logistics
- Staff
- Admin

## What BluBook Does

At a practical level, BluBook helps teams do three things:

1. Capture customer demand (purchase orders, requests, documents, messages)
2. Move that demand through internal operations (sales checks, handoffs, logistics steps)
3. Close the loop clearly (delivery, SLA outcome, audit trail, notifications)

## Product Areas

### Customer Portal

Main jobs:

- Upload purchase orders
- Track order progress step by step
- Manage documents
- View requests and communications

Main routes:

- `/customer/dashboard`
- `/customer/orders`
- `/customer/requests`
- `/customer/messages`
- `/customer/documents`
- `/customer/analytics`
- `/customer/settings`

### Partner Portal

Main jobs:

- Accept or reject incoming operational requests
- Execute work orders
- Upload required delivery documents
- View queue health and readiness

Main routes:

- `/partner/dashboard`
- `/partner/work-orders`
- `/partner/messages`
- `/partner/documents`
- `/partner/reports`

### Sales Portal

Main jobs:

- Validate orders
- Reserve inventory
- Create logistics handoffs
- Move sales states forward in a controlled way

Main routes:

- `/sales/orders`
- `/sales/work-orders`
- `/sales/invoices`
- `/sales/inventory`

### Logistics Portal

Main jobs:

- Process assigned handoffs
- Move shipment lifecycle forward
- Capture proof of delivery and closeout

Main routes:

- `/logistics/shipments`
- `/logistics/carriers`
- `/logistics/tracking`
- `/logistics/delivery`

### Admin and Staff Portals

Main jobs:

- User and role management
- Workflow operations and dispatch controls
- Governance and visibility

Main routes:

- `/admin/dashboard`
- `/admin/users`
- `/admin/roles`
- `/admin/settings`
- `/admin/audit-logs`
- `/admin/workflows`
- `/staff/dashboard`

## Full Workflow

This is the most important part of BluBook.

### Step 1: Customer uploads a purchase order

What happens:

1. Customer uploads a PO document in the customer flow.
2. The system validates that this requirement really is a purchase order requirement.
3. If valid, BluBook creates or reuses a `sales_orders` record.
4. BluBook creates at least one `sales_order_items` row.
5. Order metadata is stamped with workflow timeline data (for tracking and audit).

Key behavior:

- Initial status starts as `Purchase Order Received`.
- PO reference is generated from the uploaded file when needed.

### Step 2: Sales takes control of the order

Sales moves the order with explicit actions (no hidden auto-jumps):

1. `Purchase Order Received` -> `Order Validated`
2. `Order Validated` -> `Inventory Reserved`
3. `Inventory Reserved` -> `Logistics Handoff Created`
4. Optional sales-specific checkpoints like invoice and shipment creation

Important rule:

- Sales cannot jump to random states. Every action checks current state first.

### Step 3: Sales creates a logistics handoff

When handoff is created:

1. BluBook creates a `provider_workflow_handoffs` record.
2. The handoff links to the sales order.
3. Logistics partner assignment and service context are stored.
4. Notifications are sent to relevant users.

### Step 4: Logistics executes fulfillment steps

Logistics works through explicit milestones. Common sequence:

1. Handoff accepted
2. Warehouse/transmission step
3. Customer notification
4. Pack items
5. Shipping/tracking in transit
6. Arrival at destination
7. Customer signs proof of delivery (POD)
8. BluBook system updated
9. Complete delivery

Every step is captured as a step event in `order_workflow_step_events`.

### Step 5: Delivery closeout and SLA outcome

On successful completion:

1. Handoff status becomes `completed`.
2. Order metadata gets delivery details (`delivered_at`, `delivered_to`).
3. SLA status is computed (`met` or `missed`).
4. Timeline gets a delivery marker.
5. A final workflow step event is recorded (`delivered`).

### Step 6: Queue dispatch and system consistency

BluBook uses a workflow queue (`workflow_events_queue`) to process background transitions.

How it works:

1. API routes enqueue business events.
2. System dispatch endpoint processes events in FIFO order.
3. Events are marked `queued`, `processing`, `completed`, or `failed`.
4. Failed events stay visible for replay/troubleshooting.

Why this matters:

- It keeps workflows reliable and auditable.
- It prevents hidden state jumps from frontend-only logic.

## Workflow Step Contract (Single Source of Truth)

File: `src/lib/workflow/workflow-step-contract.ts`

This contract defines:

- The canonical step keys
- Which role owns each step
- Which audience can see each step
- Required inputs per step
- Required proof/document types
- Allowed previous step(s)

Important practical point:

- A step counts as complete only when an explicit step event is recorded.

## Architecture (Simple Version)

BluBook is database-driven.

That means:

- Backend/database state is the source of truth.
- Frontend displays and triggers actions; it does not invent business truth.
- Business transitions are done through API handlers and workflow services.

### Main layers

1. UI layer (`src/app`, `src/components`)
2. API layer (`src/app/api/**`)
3. Workflow services (`src/lib/workflow/**`, `src/services/**`)
4. Data layer (Supabase Auth, Postgres, Storage, Realtime)

## Authentication and Access Model

### Session middleware

`src/lib/supabase/middleware.ts` handles:

- Public route allowlist
- Session check on protected pages
- Redirect to login when unauthenticated

Development behavior:

- `NEXT_PUBLIC_DEV_AUTH_BYPASS` can allow local bypass unless set to `false`.

### Role and organization resolution

Most APIs resolve user context from:

- `user_profiles`
- `organization_memberships`

Then apply role checks before doing work.

## Key Data Objects (Mental Model)

- `sales_orders`: the main order record
- `sales_order_items`: line items inside an order
- `provider_workflow_handoffs`: handoff between sales and logistics/partners
- `order_workflow_step_events`: explicit completed steps
- `order_workflow_step_inputs`: structured answers/files per step
- `workflow_events_queue`: background event processing queue
- `customer_requirement_items`: customer requirements (including PO upload requirements)
- `documents`: uploaded artifacts
- `notifications`: in-app user notifications

## Notifications and Realtime

BluBook pushes status visibility through:

- Notification inserts on critical transitions
- Realtime subscriptions in dashboards
- React Query invalidation/refetch on relevant events

Result:

- Users see progress updates without manual refresh in most flows.

## AI Workflow Layer (Operational Guidance)

- AI can recommend and prioritize.
- AI must not directly write domain state.
- High-impact actions require human approval.

This is aligned with the database-driven architecture and auditability model.

## Project Structure

Top-level folders you will work in most:

- `src/app`: pages and API routes
- `src/components`: UI components and shell
- `src/lib`: shared library logic (workflow, supabase, env, utils)
- `src/services`: workflow step event services and related logic
- `src/hooks`: reusable React hooks
- `src/store`: Zustand stores
- `src/constants`: workflow states, routes, labels
- `src/features`: feature-focused modules
- `scripts`: operational/debug/seed scripts
- `docs`: supporting functional docs and schemas
- `supabase/migrations`: database migrations

## Local Setup

### Requirements

- Node.js 18+
- pnpm

### Install

```bash
pnpm install
```

### Environment file

Create `.env.local` and set required values.

Minimum required public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required for server-side onboarding operations:

- `SUPABASE_SERVICE_ROLE_KEY`

Required for email operations:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Run locally

```bash
pnpm dev
```

Open:

- `http://localhost:3000`

## Common Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
```

Useful operational scripts:

```bash
pnpm debug:auth:partner
pnpm debug:login:partner
pnpm db:introspect
pnpm email:test:onboarding
pnpm seed:providers:mock
```

## API Areas You Will Touch Most

- Customer flow kickoff:
  - `/api/customer/workflow/po-uploaded`
  - `/api/customer/orders`
  - `/api/customer/requirements`

- Sales flow control:
  - `/api/sales/orders/advance`

- Partner and logistics execution:
  - `/api/partner/dashboard`
  - `/api/partner/work-orders`
  - `/api/partner/purchase-orders/confirm`

- System workflow operations:
  - `/api/system/workflow/dispatch`
  - `/api/system/workflow/orders`
  - `/api/system/workflow/reconcile-delivered`

- Step visibility and completion:
  - `/api/orders/[orderId]/step-events`
  - `/api/orders/[orderId]/step-inputs`

## How to Think About Troubleshooting

When something looks wrong in UI, check in this order:

1. Is the order state updated in `sales_orders`?
2. Is the handoff state updated in `provider_workflow_handoffs`?
3. Were required step events recorded in `order_workflow_step_events`?
4. Was metadata timeline updated (`workflow_timeline`, delivery markers)?
5. Is there a failed queue event in `workflow_events_queue`?

This sequence usually finds the real source quickly.

## Project Rules

1. System is database-driven.
2. Packages/streams/pricing/partner mappings come from database records.
3. Customer-facing production paths should not rely on mock-only truth.
4. Schema-dependent features should include API + migration alignment.

## Final Notes

- This README is the consolidated product overview and operating guide.
- Keep workflow changes aligned with the step contract and queue processing model.
- Prefer explicit, recorded step events over inferred state.

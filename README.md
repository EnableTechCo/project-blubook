# BluBook Frontend

BluBook is a multi-role operations app built with Next.js. It provides dedicated portal experiences for customer, partner, staff, logistics, sales, and admin users.

## What The App Includes

- Role-based portal routing and layouts
- Authentication screens (login, register, invite, reset password)
- Customer workflows (requests, messages, documents, analytics, settings)
- Partner workflows (dashboard, inbox, work orders, messages, reports)
- Sales workflows (orders, work orders, invoices, inventory)
- Logistics workflows (shipments, carriers, tracking, delivery)
- Admin workflows (dashboard, users, roles, settings, audit logs, workflows)

## Workflows

BluBook supports cross-role operational workflows from request intake to completion:

- Customer submits and tracks service requests.
- Partner teams coordinate execution and progress updates.
- Sales and logistics teams handle fulfillment and delivery handoffs.
- Admin teams govern role access, workflow configuration, and audit trails.

Workflow-related UI is available in these key areas:

- /customer/requests
- /sales/work-orders
- /logistics/shipments
- /admin/workflows

## Tech Stack

- Next.js App Router
- TypeScript (strict mode)
- Tailwind CSS
- Supabase client integration
- Zustand and React Query

## App Routes

- Public and auth:
  - /
  - /login
  - /register
  - /forgot-password
  - /reset-password

- Customer:
  - /customer/dashboard
  - /customer/requests
  - /customer/messages
  - /customer/documents
  - /customer/analytics
  - /customer/settings

- Partner:
  - /partner/dashboard
  - /partner/inbox
  - /partner/work-orders
  - /partner/messages
  - /partner/documents
  - /partner/reports

- Sales:
  - /sales/orders
  - /sales/work-orders
  - /sales/invoices
  - /sales/inventory

- Logistics:
  - /logistics/shipments
  - /logistics/carriers
  - /logistics/tracking
  - /logistics/delivery

- Admin:
  - /admin/dashboard
  - /admin/users
  - /admin/roles
  - /admin/settings
  - /admin/audit-logs
  - /admin/workflows

## Local Setup

1. Install dependencies.

   npm install

2. Create environment file.

   On PowerShell:
   Copy-Item .env.example .env.local

   On bash:
   cp .env.example .env.local

3. Fill required keys in .env.local.

4. Run local server.

   npm run dev

## Scripts

- pnpm dev
- pnpm build
- pnpm start
- pnpm lint
- pnpm typecheck

## Testing And Quality Assurance

Use pnpm for all QA commands:

- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm audit

## Mock Data Mode

The app includes centralized mock datasets used by dashboards and operational views. This allows frontend work and QA to continue before full backend completion.

Main mock modules:

- src/features/mock/core-data.ts
- src/features/mock/dashboard-packs.ts
- src/features/mock/workspace-pages.ts
- src/features/mock/ai-scenarios.ts

Mock user fixtures:

- src/features/mock/core-data.ts (MOCK_USERS)

Where to see mock test users in UI:

- /login (Mock Test Users panel + quick access buttons)

## Notes

- Keep .env.local out of source control.
- Keep UI data contracts aligned with shared mock types to reduce rework later.

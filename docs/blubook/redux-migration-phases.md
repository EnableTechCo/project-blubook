# Redux And Fetch-State Migration Plan

## Objective
Reduce duplicate network requests, centralize server-state ownership, and normalize loading/error/refresh UX across customer, partner, sales, logistics, and admin surfaces.

## Phase 1: Foundation (Session, Context, Notifications)

### Scope
- Add Redux Toolkit store wiring to app providers.
- Introduce RTK Query base API.
- Migrate auth user and customer context query ownership from page-level React Query hooks to RTK Query.
- Move notification list and unread derivation to RTK Query + Redux selectors.

### Exit Criteria
- Session/context have a single shared client cache owner.
- Notifications are read from one cache path in shell and customer messages.
- No direct per-page fetch for auth context.

### Tests
- Store reducer and middleware setup test.
- Session API hook test for auth-context happy/error states.
- Notifications invalidation and selector behavior test.

## Phase 2: Customer Domain

### Scope
- Migrate customer billing, orders, requirements, provider-readiness, and step-events to RTK Query.
- Remove duplicate endpoint calls across customer dashboard, settings, billing, and orders routes.
- Standardize loading states: initial load skeleton, background refresh indicator, mutation pending states.

### Exit Criteria
- Shared customer resources are fetched once per cache key and reused between pages.
- Customer pages do not run ad-hoc fetch lifecycles for migrated resources.
- Mutation actions use targeted invalidation or optimistic updates.

### Tests
- Customer API endpoint tests for orders and billing.
- UI tests for loading/error/empty states on migrated customer pages.
- Mutation tests for order retract and billing action flows.

## Phase 3: Partner, Sales, Logistics

### Scope
- Migrate partner dashboard/work-orders, sales orders, logistics shipments fetch orchestration into RTK Query endpoints.
- Replace manual fetch loops and in-component ref guards with query subscriptions.
- Normalize workflow transition pending/error handling.

### Exit Criteria
- Partner, sales, and logistics pages rely on shared RTK Query hooks for core data.
- Realtime updates trigger targeted cache invalidation/update only.
- Page-level manual loading flags are reduced to local UI concerns only.

### Tests
- Endpoint tests for partner dashboard and work-orders transitions.
- Sales/logistics workflow transition tests with pending/error states.
- Realtime update cache-refresh behavior test.

## Phase 4: Admin Domain And Polling Reduction

### Scope
- Migrate admin users, customers, orders, work-orders, documents, dispatch queue, and dashboard metrics into RTK Query.
- Replace blanket polling with event-driven updates where available and conservative fallback intervals where not.
- Unify admin loading and error rendering behavior.

### Exit Criteria
- Admin pages use centralized query ownership with minimal duplicate calls.
- Polling is either removed or justified and throttled.
- Dispatch and document actions invalidate only affected queries.

### Tests
- Admin endpoint tests for users/customers/documents/dispatch.
- Polling behavior test (no runaway refetch loops).
- Admin table loading/empty/error state tests.

## Phase 5: Cleanup And Consolidation

### Scope
- Remove redundant React Query usage and duplicate fetch utilities where superseded by RTK Query.
- Consolidate store ownership boundaries (server data vs UI-only state).
- Normalize shared loading/error components and finalize performance instrumentation.

### Exit Criteria
- Migrated domains have no duplicate fetch ownership.
- Loading-state conventions are consistent across routes.
- Legacy duplicate state containers are removed or narrowed to UI-only roles.

### Tests
- Integration tests for key cross-page navigation cache reuse.
- Regression tests for auth/session expiry handling.
- Final suite run for lint, typecheck, and unit tests.

## Execution Notes
- Execute phases in order without skipping test gates.
- For each phase: implement, add tests, run targeted tests, then run typecheck.
- Keep behavior unchanged except improved cache reuse and loading-state consistency.

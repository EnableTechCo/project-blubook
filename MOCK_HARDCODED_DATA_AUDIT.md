# Mock and Hardcoded Data Audit (Simple Version)

Date: 2026-06-13

## What This Means In Plain English

You have 3 kinds of hardcoded/mock data in the app:

1. Demo content intentionally stored in `src/features/mock`
2. Real app pages that still render that demo content
3. Production API logic that depends on `mock_account` metadata from seeded test accounts

The biggest problem is not that mock files exist. The biggest problem is that some live pages and APIs still rely on them.

## Top 5 Things To Fix First

1. Remove visible test login from UI in [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx#L942)
   Explanation: A user can currently see a test email and password in the interface. That is a security and trust issue and should not be visible in a real app.

2. Gate or remove the demo order generator UI in [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx#L1002)
   Explanation: This button creates fake/demo orders. If people use it in normal operations, fake data can mix with real business data.

3. Gate or remove demo-order API in [src/app/api/system/workflow/demo-order/route.ts](src/app/api/system/workflow/demo-order/route.ts#L27)
   Explanation: Hiding the button is not enough. The backend endpoint can still be called directly unless it is also restricted or removed.

4. Replace `mock_account` lookup dependency in partner/workflow APIs (see list below)
   Explanation: Core workflow behavior currently depends on test-account metadata. Production logic should use proper real account mappings.

5. Replace fallback demo identity `BluBook Demo Customer` in [src/store/customer-journey-store.ts](src/store/customer-journey-store.ts#L318)
   Explanation: When real customer data is missing, users should see a clear empty-state message, not a fake demo company identity.

## Severity Overview

### High (should be fixed first)

- Test credentials shown to users:
  - [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx#L942)
- Demo generator in live sales UI:
  - [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx#L1002)
- Demo order API creates real records with hardcoded items:
  - [src/app/api/system/workflow/demo-order/route.ts](src/app/api/system/workflow/demo-order/route.ts)
- Production logic tied to `mock_account` metadata:
  - [src/app/api/partner/dashboard/route.ts](src/app/api/partner/dashboard/route.ts#L82)
  - [src/app/api/partner/work-orders/route.ts](src/app/api/partner/work-orders/route.ts#L108)
  - [src/app/api/orders/[orderId]/step-events/route.ts](src/app/api/orders/[orderId]/step-events/route.ts#L151)
  - [src/app/api/sales/orders/advance/route.ts](src/app/api/sales/orders/advance/route.ts#L115)
  - [src/app/api/customer/workflow/po-uploaded/route.ts](src/app/api/customer/workflow/po-uploaded/route.ts#L175)
  - [src/app/api/partner/purchase-orders/confirm/route.ts](src/app/api/partner/purchase-orders/confirm/route.ts#L30)
  - [src/lib/workflow/service-partner-routing.ts](src/lib/workflow/service-partner-routing.ts#L42)
  - [src/lib/workflow/order-lifecycle.ts](src/lib/workflow/order-lifecycle.ts#L113)

### Medium (clean up next)

- Demo fallback customer name in store state:
  - [src/store/customer-journey-store.ts](src/store/customer-journey-store.ts#L318)
- Seed scripts that create mock accounts + `mock_account` metadata:
  - [scripts/seed-mock-provider-accounts.mjs](scripts/seed-mock-provider-accounts.mjs)
  - [scripts/seed-logistics-account.mjs](scripts/seed-logistics-account.mjs)

### Low (acceptable if intentional)

- Central mock modules (good to keep if they are truly demo-only):
  - [src/features/mock/core-data.ts](src/features/mock/core-data.ts)
  - [src/features/mock/dashboard-packs.ts](src/features/mock/dashboard-packs.ts)
  - [src/features/mock/workspace-pages.ts](src/features/mock/workspace-pages.ts)
  - [src/features/mock/ai-scenarios.ts](src/features/mock/ai-scenarios.ts)
  - [src/features/mock/onboarding-data.ts](src/features/mock/onboarding-data.ts)

## Where Live Pages Still Show Mock Data

### Admin pages

- [src/app/admin/dashboard/page.tsx](src/app/admin/dashboard/page.tsx#L9)
- [src/app/admin/roles/page.tsx](src/app/admin/roles/page.tsx#L2)
- [src/app/admin/settings/page.tsx](src/app/admin/settings/page.tsx#L2)
- [src/app/admin/audit-logs/page.tsx](src/app/admin/audit-logs/page.tsx#L2)
- [src/app/admin/users/page.tsx](src/app/admin/users/page.tsx#L3)

### Sales pages

- [src/app/sales/orders/page.tsx](src/app/sales/orders/page.tsx#L2)
- [src/app/sales/work-orders/page.tsx](src/app/sales/work-orders/page.tsx#L2)
- [src/app/sales/invoices/page.tsx](src/app/sales/invoices/page.tsx#L2)
- [src/app/sales/inventory/page.tsx](src/app/sales/inventory/page.tsx#L2)

### Logistics pages

- [src/app/logistics/shipments/page.tsx](src/app/logistics/shipments/page.tsx#L2)
- [src/app/logistics/tracking/page.tsx](src/app/logistics/tracking/page.tsx#L2)
- [src/app/logistics/delivery/page.tsx](src/app/logistics/delivery/page.tsx#L2)
- [src/app/logistics/carriers/page.tsx](src/app/logistics/carriers/page.tsx#L2)

### Staff pages

- [src/app/staff/dashboard/page.tsx](src/app/staff/dashboard/page.tsx#L8)

## Things I Checked That Are Not Currently Mock-Driven

- [src/app/customer/analytics/requests/page.tsx](src/app/customer/analytics/requests/page.tsx)
- [src/app/customer/analytics/requests/[id]/page.tsx](src/app/customer/analytics/requests/[id]/page.tsx)
- [src/app/customer/documents/page.tsx](src/app/customer/documents/page.tsx)
- [src/app/partner/documents/page.tsx](src/app/partner/documents/page.tsx)

These are currently sessionStorage/API-driven rather than mock fixture-driven.

## One-Page Conclusion

- Most mock data is in one place, which is good.
- But several real pages still render that mock data.
- The most urgent risk is hardcoded test-account plumbing (`mock_account`) in production API paths.
- If you want this app production-clean, start with the High list first.

## Additional Findings: Partner Streams And Requirements

This section answers your two questions directly.

### 1) How many partner streams do we have?

Current findings from the codebase:

- 10 streams are defined in requirement mapping constants:
  - IT Hosting
  - Financial Accounting
  - Human Resources
  - Marketing
  - Post Sales Support
  - Logistics
  - Sales Ops
  - Legal
  - Mgt Consulting
  - Office

Comment to fix:

- These are not good naming conventions.
- Mgt Consulting is unclear to most readers and should be a full business name.

Readable naming proposal:

- IT Hosting -> IT Infrastructure and Hosting
- Financial Accounting -> Finance and Accounting
- Human Resources -> Human Resources and People Operations
- Marketing -> Marketing and Growth
- Post Sales Support -> Customer Support and Success
- Logistics -> Logistics and Fulfillment
- Sales Ops -> Sales Operations
- Legal -> Legal and Compliance
- Mgt Consulting -> Management Consulting and Advisory
- Office -> Workplace and Office Services

Naming rule set (for future streams):

- Avoid abbreviations unless universally understood.
- Use full business terms, not internal shorthand.
- Keep names readable to non-technical users.
- Keep naming style consistent across all streams.
- 8 streams currently have configured partner entries in the service partner catalog constants:
  - IT Hosting
  - Financial Accounting
  - Human Resources
  - Marketing
  - Post Sales Support
  - Sales Ops
  - Legal
  - Mgt Consulting

Important gap:

- Logistics and Office have requirement definitions, but they are not represented in the current `SERVICE_PARTNERS` constant list.

### 2) Do we have real-world requirements for each stream?

Short answer:

- Yes, there is a stream-based requirement system.
- It is partly real-world, but quality/depth is uneven by stream.

What exists today:

- Requirement model exists in DB tables (`requirement_templates` and `customer_requirement_items`) and is used in API routes.
- Partner upload requirement keys are mapped by stream in `PARTNER_UPLOAD_FILE_TYPES`.

Current requirement counts by stream (from constants):

- IT Hosting: 4
- Financial Accounting: 4
- Human Resources: 3
- Marketing: 3
- Post Sales Support: 4
- Logistics: 2
- Sales Ops: 4
- Legal: 2
- Mgt Consulting: 2
- Office: 2

Assessment:

- The structure is stream-aware and supports different requirement counts per stream, which is good.
- Some streams have richer requirement coverage than others.
- Some requirement items are generic placeholders and should be strengthened into strict SLA-grade requirements.

## Fully Fleshed Dynamic Stream Requirement Model (Concept)

No onboarding UI draft is included here. This is data and process design only.

### A) Core entities

1. Stream Catalog

- One row per stream (name, code, active status, owner team).
- Optional metadata: risk tier, regulatory flag, default SLA family.

2. Requirement Templates

- Belong to a stream.
- Versioned.
- Include:
  - requirement key
  - business title
  - why required
  - evidence type
  - required/optional flag
  - due policy
  - approval policy
  - rejection policy
  - SLA impact class (blocking/non-blocking)

3. Stream-to-Partner Assignments

- Partner assigned to one or more streams.
- Assignment should reference template version used at assignment time.

4. Partner Requirement Instances

- Created from templates when stream is assigned to partner.
- Tracks live status per requirement:
  - missing
  - submitted
  - approved
  - rejected
  - waived

### B) Assignment behavior (what should happen)

When a stream is assigned to a partner:

1. Load active template set for that stream.
2. Create requirement instances for that partner-stream pair.
3. Set due dates from stream SLA policy.
4. Mark stream readiness as blocked until all blocking requirements are approved.

### C) SLA behavior

Each requirement should explicitly state SLA effect:

- Blocking requirement:
  - stream cannot move to active delivery state until approved.
- Non-blocking requirement:
  - stream can operate, but creates SLA risk score and escalation timer.

### D) Real-world quality standard per requirement

Each requirement should include:

1. Concrete business proof expected
2. Accept/reject rubric
3. Owner role for approval
4. Revalidation frequency (one-time, monthly, quarterly, annual)
5. Auto-expiry behavior

### E) Governance and change control

1. Template versioning required
2. Existing assignments remain on prior version until explicit migration
3. Diff view required for compliance reviews
4. Audit trail required for approvals, rejections, waivers, and overrides

### F) Current-state gaps against target

1. Stream and requirement definitions are split across constants and DB usage paths.
2. Coverage depth varies per stream.
3. Some partner stream catalogs and requirement stream catalogs are not fully aligned.
4. Workflow paths still include hardcoded assumptions in places (for example, fixed stream names in some logic).

## Fixes Needed List (Execution Tracker)

- [x] Remove visible test credentials and guided mock walkthrough from sales UI
  - Updated [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx)
- [x] Remove mock-order generator UI from live sales page
  - Updated [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx)
- [x] Disable demo-order API endpoint
  - Updated [src/app/api/system/workflow/demo-order/route.ts](src/app/api/system/workflow/demo-order/route.ts)
- [x] Replace partner resolution logic that depended on `mock_account`
  - Updated [src/app/api/partner/dashboard/route.ts](src/app/api/partner/dashboard/route.ts)
  - Updated [src/app/api/partner/work-orders/route.ts](src/app/api/partner/work-orders/route.ts)
  - Updated [src/app/api/orders/[orderId]/step-events/route.ts](src/app/api/orders/[orderId]/step-events/route.ts)
  - Updated [src/app/api/sales/orders/advance/route.ts](src/app/api/sales/orders/advance/route.ts)
  - Updated [src/app/api/partner/purchase-orders/confirm/route.ts](src/app/api/partner/purchase-orders/confirm/route.ts)
  - Added [src/lib/workflow/partner-context.ts](src/lib/workflow/partner-context.ts)
- [x] Replace provider-email fallback from mock metadata keys
  - Updated [src/app/api/customer/workflow/po-uploaded/route.ts](src/app/api/customer/workflow/po-uploaded/route.ts)
  - Updated [src/lib/workflow/service-partner-routing.ts](src/lib/workflow/service-partner-routing.ts)
- [x] Replace demo fallback identity in customer journey store
  - Updated [src/store/customer-journey-store.ts](src/store/customer-journey-store.ts)
- [x] Remove live-page dependency on `@/features/mock/dashboard-data`
  - Updated [src/app/admin/audit-logs/page.tsx](src/app/admin/audit-logs/page.tsx)
  - Updated [src/app/admin/dashboard/page.tsx](src/app/admin/dashboard/page.tsx)
  - Updated [src/app/admin/roles/page.tsx](src/app/admin/roles/page.tsx)
  - Updated [src/app/admin/settings/page.tsx](src/app/admin/settings/page.tsx)
  - Updated [src/app/admin/users/page.tsx](src/app/admin/users/page.tsx)
  - Updated [src/app/logistics/carriers/page.tsx](src/app/logistics/carriers/page.tsx)
  - Updated [src/app/logistics/delivery/page.tsx](src/app/logistics/delivery/page.tsx)
  - Updated [src/app/logistics/shipments/page.tsx](src/app/logistics/shipments/page.tsx)
  - Updated [src/app/logistics/tracking/page.tsx](src/app/logistics/tracking/page.tsx)
  - Updated [src/app/sales/invoices/page.tsx](src/app/sales/invoices/page.tsx)
  - Updated [src/app/sales/inventory/page.tsx](src/app/sales/inventory/page.tsx)
  - Updated [src/app/sales/orders/page.tsx](src/app/sales/orders/page.tsx)
  - Updated [src/app/sales/work-orders/page.tsx](src/app/sales/work-orders/page.tsx)
  - Updated [src/app/staff/dashboard/page.tsx](src/app/staff/dashboard/page.tsx)
  - Added [src/constants/workspace-content.ts](src/constants/workspace-content.ts)

## Practical recommendation before mock removal

Do this first, in this order:

1. Finalize canonical stream catalog in DB as source of truth.
2. Finalize requirement templates per stream with SLA-grade criteria.
3. Ensure partner assignment always materializes stream-specific requirement instances.
4. Remove constant-based fallbacks only after DB-backed stream+requirement lifecycle is fully active.

## UI And UX Todo Tracker (Bottom Tracking List)

Use this section to track visual/product behavior fixes, not only backend changes.

- [x] Remove visible test credentials from user-facing sales UI
  - Implemented in [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx)
- [x] Remove demo order generator controls from live UI
  - Implemented in [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx)
- [x] Replace fallback demo customer identity with real empty-state behavior
  - Implemented in [src/store/customer-journey-store.ts](src/store/customer-journey-store.ts)
- [x] Replace live dashboard mock imports in Admin/Sales/Logistics/Staff pages
  - Implemented via [src/constants/workspace-content.ts](src/constants/workspace-content.ts)

- [x] Add partner-side review controls for customer-submitted files (approve vs request resubmission)
  - Why: Partner must be able to confirm files are valid or send them back when incorrect/incomplete.
  - Implemented API in [src/app/api/partner/requirements/review/route.ts](src/app/api/partner/requirements/review/route.ts)
  - Implemented UI buttons + reason input in [src/app/partner/dashboard/[requestId]/page.tsx](src/app/partner/dashboard/[requestId]/page.tsx)
  - Requirement payload now includes status reason in [src/app/api/partner/dashboard/route.ts](src/app/api/partner/dashboard/route.ts)

- [x] Standardize stream naming labels in user-facing UI (remove unclear abbreviations)
  - Priority target completed: "Mgt Consulting" now displays as "Management Consulting and Advisory" across active workflows.
  - Centralized display mapping in [src/constants/stream-display.ts](src/constants/stream-display.ts)
  - Applied in [src/app/partner/dashboard/page.tsx](src/app/partner/dashboard/page.tsx), [src/app/partner/dashboard/[requestId]/page.tsx](src/app/partner/dashboard/[requestId]/page.tsx), [src/app/partner/work-orders/partner-work-orders-client.tsx](src/app/partner/work-orders/partner-work-orders-client.tsx), [src/app/sales/orders/sales-orders-client.tsx](src/app/sales/orders/sales-orders-client.tsx), and [src/app/customer/requests/[id]/page.tsx](src/app/customer/requests/[id]/page.tsx)
- [x] Add explicit "unavailable stream" UX state when stream exists in requirements but partner catalog is missing mapping
  - Implemented blocked-state card with clear reason + action guidance in [src/app/partner/documents/page.tsx](src/app/partner/documents/page.tsx)
  - Document manager now blocks upload controls when stream mapping is missing instead of silently falling back.
- [x] Add consistent requirement status microcopy for users
  - Required wording pattern implemented:
    - Submitted: "Waiting for partner review"
    - Approved: "Accepted by partner"
    - Rejected: "Changes requested - see reason"
  - Implemented in [src/app/partner/dashboard/[requestId]/page.tsx](src/app/partner/dashboard/[requestId]/page.tsx) and [src/app/customer/requests/[id]/page.tsx](src/app/customer/requests/[id]/page.tsx)

### New UI Behavior Added For File Review

For each required item on the partner request detail screen:

1. Partner can open submitted files.
2. Partner can click `Approve Submission`.
3. Partner can enter a reason and click `Request Resubmission` when files are incorrect or missing details.
4. Customer-side workflow can then treat rejected items as needing re-upload.

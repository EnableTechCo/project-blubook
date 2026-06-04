# Auth And Billing Database Foundation

This migration establishes the first database-owned layer for:

- customer onboarding submissions
- organization and role membership
- partner and admin invitations
- package catalog
- subscriptions
- invoices and invoice line items
- outbound email queue and delivery tracking

Primary file:

- `supabase/migrations/20260603_auth_billing_foundation.sql`

Tables introduced:

- `organizations`
- `user_profiles`
- `organization_memberships`
- `service_packages`
- `customer_onboarding_submissions`
- `subscriptions`
- `invoices`
- `invoice_line_items`
- `invitations`
- `outbound_emails`

Design intent:

- Customers enter through onboarding, not a standalone registration page.
- Partners and admins enter through invitation-only activation.
- Billing becomes a first-class customer capability backed by `subscriptions` and `invoices`.
- Email delivery is app-owned and auditable through `outbound_emails`.
- Email HTML lives in `src/emails/templates`, not in the database.

Expected next application steps:

1. Insert an `organizations` row for each new customer onboarding completion.
2. Insert a `customer_onboarding_submissions` row before or at account activation.
3. Create a `subscriptions` row from the selected `service_packages` entry.
4. Create an `invoices` row and one or more `invoice_line_items` rows for the purchase.
5. Queue an `outbound_emails` record using the file-based template key.
6. Build `/customer/billing` against `subscriptions` and `invoices`.

Notes:

- This migration creates the schema foundation only. It does not yet include RLS policies.
- Package prices are seeded to match the current onboarding package UI.
- Runtime email templates are stored in `src/emails/templates`.

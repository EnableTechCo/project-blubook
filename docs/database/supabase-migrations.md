# Supabase migration operations

## Ownership and baseline

The linked Supabase database was the schema authority before this repository began
tracking migrations. `supabase/migrations/20260720152317_baseline_schema.sql` is a
schema-only public-schema baseline captured on 2026-07-20. It includes application
tables, constraints, indexes, RLS policies, grants, functions, and RPCs; it contains
no production row data, credentials, tokens, or local environment values.

The application does not own custom `auth` or `storage` schema objects. The baseline
therefore keeps application-owned public objects only, while retaining references to
Supabase-managed `auth` helpers where public RLS policies require them.

From this point onward, migration files are the only source of schema changes.
Never make production schema changes in the Supabase Dashboard SQL or Table Editor.

## Daily development workflow

1. Start from current `develop` and create a branch.
2. Create an immutable migration: `supabase migration new <change_description>`.
3. Add the reviewed SQL to `supabase/migrations/<timestamp>_<change_description>.sql`.
4. Rebuild the local database: `supabase db reset`.
5. Inspect the resulting schema: `supabase db diff --local`. An empty diff means the
   migration history reproduces the local schema; any non-empty output must be
   understood and included in review.
6. Run application checks and review the SQL, locks, RLS, grants, data backfill, and
   deploy order in the PR. Commit the migration with the application change.
7. After merge, an explicitly authorized deployer runs `supabase db push` once
   against production. Do not push concurrently from multiple machines.

Use `supabase migration list --linked` before creating or deploying a migration to
compare local files with the remote migration-history table.

## Rollback and safe rollout discipline

Migrations are append-only: never edit a migration that has been applied anywhere.
Every migration PR must state its reversal or corrective-forward-migration steps.

For destructive changes, use a staged two-phase rollout:

1. Add compatible schema and dual-read/dual-write application support.
2. Backfill and validate data with observability in place.
3. Switch readers and writers only after the backfill is verified.
4. Remove obsolete columns, tables, or constraints in a later migration and release.

Production rollback is a forward fix: add a new corrective migration and deploy it
through the same reviewed process. Do not restore an old migration file or attempt a
best-effort manual reversal in the Dashboard.

## Migration-history drift

`supabase migration list --linked` reports local and remote history separately.
First determine whether the database schema or the history table is wrong. If a
remote-only change exists, capture it as a new migration with `supabase db pull` and
review it. If the actual schema is correct but only the history row is wrong,
`supabase migration repair --status applied|reverted <timestamp>` updates tracking
metadata only; it does not run SQL. It requires explicit approval and a documented
comparison of the real schema before use.

Never run `supabase migration repair`, `supabase db push`, or `supabase db reset
--linked` against a remote database without explicit approval.

## Local prerequisites and verification

Supabase CLI and Docker Desktop are required for local reset and diff commands. The
project's Supabase CLI configuration is tracked in `supabase/config.toml`; `.temp`,
local credentials, branch runtime state, and database dumps stay ignored.

For this baseline, verify with:

```bash
supabase db reset
supabase migration list --linked
supabase db diff --local
```

The reset must apply the baseline cleanly, and the local diff must be empty or have a
documented, intentional explanation before merge.

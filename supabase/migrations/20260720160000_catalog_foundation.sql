-- Catalog foundation (Phase 1, P1-1)
--
-- Normalizes the package -> service -> work-order catalog out of the
-- denormalized service_packages.metadata.streams JSON into queryable,
-- admin-editable tables, and introduces the dependency graph (a DAG) that
-- nothing encoded before.
--
-- "service" is a canonical registry (public.services), keyed by the same
-- stream string that service_partners.package_stream already uses, so
-- routing stays a direct string match while the new catalog layer gains
-- referential integrity and a single source of truth for the admin UI.
-- Existing service_partners.package_stream is intentionally left as free
-- text for now — this migration does not touch it.

-- ─── services: canonical registry ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,   -- the stream string routing matches on
  name        TEXT        NOT NULL,          -- display name (defaults to key)
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the registry from the authoritative fulfillment source: the streams
-- that service_partners actually offer. A service only exists if a provider
-- can do the work, so this is the canonical set. Idempotent.
--
-- Note: package metadata.streams was deliberately NOT used as a seed source.
-- It disagrees with reality in two ways in the current data:
--   * "Office" appears as a stream key in the premium / premium-plus packages
--     but is really an IT Hosting *item*, and no provider offers it — seeding
--     it would put a non-service into the registry.
--   * "Logistics" is offered by providers (and is a dependency target) but is
--     not listed as a package stream, since it is dependency-triggered rather
--     than sold directly.
-- Reconciling package streams against this registry is a P1-3 concern.
INSERT INTO public.services (key, name)
SELECT DISTINCT trim(package_stream), trim(package_stream)
FROM public.service_partners
WHERE package_stream IS NOT NULL
  AND length(trim(package_stream)) > 0
ON CONFLICT (key) DO NOTHING;

-- ─── catalog_items: the deterministic work-order menu per service ────────────
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID        NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  item_key    TEXT        NOT NULL,          -- stable slug, e.g. 'quotation-generation'
  label       TEXT        NOT NULL,          -- display label, e.g. 'Quotation Generation'
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, item_key)
);

CREATE INDEX IF NOT EXISTS catalog_items_service_id_idx
  ON public.catalog_items (service_id);

-- ─── package_services: which services a package includes ─────────────────────
CREATE TABLE IF NOT EXISTS public.package_services (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID        NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  service_id UUID        NOT NULL REFERENCES public.services(id)         ON DELETE CASCADE,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, service_id)
);

CREATE INDEX IF NOT EXISTS package_services_package_id_idx
  ON public.package_services (package_id);
CREATE INDEX IF NOT EXISTS package_services_service_id_idx
  ON public.package_services (service_id);

-- ─── catalog_item_dependencies: the dependency graph (DAG) ────────────────────
-- Edges are inherent to work type: catalog_item_id "depends on" depends_on_item_id
-- (the prerequisite must complete first). Acyclicity is enforced in the
-- application layer (P1-4) since Postgres cannot express it as a constraint.
CREATE TABLE IF NOT EXISTS public.catalog_item_dependencies (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id    UUID        NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  depends_on_item_id UUID        NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_item_id, depends_on_item_id),
  CHECK (catalog_item_id <> depends_on_item_id)
);

CREATE INDEX IF NOT EXISTS catalog_item_deps_item_idx
  ON public.catalog_item_dependencies (catalog_item_id);
CREATE INDEX IF NOT EXISTS catalog_item_deps_depends_on_idx
  ON public.catalog_item_dependencies (depends_on_item_id);

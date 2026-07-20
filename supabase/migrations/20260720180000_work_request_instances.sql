-- Work-request instances (Phase 2, P2-1)
--
-- The per-customer instance layer of the catalog workflow. A customer
-- selection creates one work_request (the parent) holding a graph of
-- work_request_items (the actual work orders), with the dependency edges
-- materialized per instance so the gated-release engine (Phase 3) can walk
-- them without re-reading the catalog.

-- ─── work_requests: the parent request / one graph per selection ─────────────
CREATE TABLE IF NOT EXISTS public.work_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id)   ON DELETE SET NULL,
  customer_id     UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  package_id      UUID        REFERENCES public.service_packages(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_requests_customer_idx     ON public.work_requests (customer_id);
CREATE INDEX IF NOT EXISTS work_requests_organization_idx ON public.work_requests (organization_id);
CREATE INDEX IF NOT EXISTS work_requests_status_idx       ON public.work_requests (status);

-- ─── work_request_items: the actual work orders ──────────────────────────────
-- catalog_item_id / service_id use ON DELETE RESTRICT: a catalog item with
-- live instances can be deactivated but not deleted out from under them.
CREATE TABLE IF NOT EXISTS public.work_request_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_request_id     UUID        NOT NULL REFERENCES public.work_requests(id) ON DELETE CASCADE,
  catalog_item_id     UUID        NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  service_id          UUID        NOT NULL REFERENCES public.services(id)      ON DELETE RESTRICT,
  assigned_provider_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
  -- blocked: waiting on a prerequisite. ready: dispatchable. assigned: routed
  -- to a provider. in_progress: provider working. completed: done.
  status              TEXT        NOT NULL DEFAULT 'blocked'
                      CHECK (status IN ('blocked', 'ready', 'assigned', 'in_progress', 'completed')),
  -- true when the customer picked this item directly; false when the system
  -- auto-included it as a dependency (surfaced to the customer at creation).
  auto_included       BOOLEAN     NOT NULL DEFAULT false,
  released_at         TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_request_items_request_idx  ON public.work_request_items (work_request_id);
CREATE INDEX IF NOT EXISTS work_request_items_status_idx   ON public.work_request_items (status);
CREATE INDEX IF NOT EXISTS work_request_items_provider_idx ON public.work_request_items (assigned_provider_id);
CREATE INDEX IF NOT EXISTS work_request_items_service_idx  ON public.work_request_items (service_id);

-- ─── work_request_item_dependencies: the materialized instance graph ─────────
CREATE TABLE IF NOT EXISTS public.work_request_item_dependencies (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_request_item_id UUID        NOT NULL REFERENCES public.work_request_items(id) ON DELETE CASCADE,
  depends_on_item_id   UUID        NOT NULL REFERENCES public.work_request_items(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_request_item_id, depends_on_item_id),
  CHECK (work_request_item_id <> depends_on_item_id)
);

CREATE INDEX IF NOT EXISTS work_request_item_deps_item_idx
  ON public.work_request_item_dependencies (work_request_item_id);
CREATE INDEX IF NOT EXISTS work_request_item_deps_depends_on_idx
  ON public.work_request_item_dependencies (depends_on_item_id);

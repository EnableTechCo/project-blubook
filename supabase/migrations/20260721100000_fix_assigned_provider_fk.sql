-- Repoint work_request_items.assigned_provider_id at service_partners.
--
-- P2-1 declared this column as REFERENCES auth.users(id), but every part of
-- the routing model treats it as a service provider, not a person:
--   * the load-balancing router (P3-1) scores and returns service_partners.id
--   * dispatch (P3-3) writes the same id to customer_provider_requests.provider_id,
--     which itself references service_partners
--   * the provider UI (P3-5) lists work by the partner id resolved from
--     partner-context
--
-- The mismatch made every dispatch fail the foreign key at runtime; it was
-- invisible to unit tests because those mock the database. Caught by the P3-7
-- end-to-end run.
--
-- Safe to apply: dispatch has never succeeded, so no row currently carries a
-- non-null assigned_provider_id. The guard below fails loudly rather than
-- silently dropping data should that ever stop being true.

DO $$
DECLARE
  orphaned INTEGER;
BEGIN
  SELECT count(*) INTO orphaned
  FROM public.work_request_items wri
  WHERE wri.assigned_provider_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.service_partners sp WHERE sp.id = wri.assigned_provider_id
    );

  IF orphaned > 0 THEN
    RAISE EXCEPTION
      'Cannot repoint assigned_provider_id: % row(s) reference an id that is not a service_partner.',
      orphaned;
  END IF;
END $$;

ALTER TABLE public.work_request_items
  DROP CONSTRAINT IF EXISTS work_request_items_assigned_provider_id_fkey;

ALTER TABLE public.work_request_items
  ADD CONSTRAINT work_request_items_assigned_provider_id_fkey
  FOREIGN KEY (assigned_provider_id)
  REFERENCES public.service_partners(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.work_request_items.assigned_provider_id IS
  'The service_partner this work order is routed to (P3-1 load-balancing router).';

-- Catalog seed (Phase 1, P1-3)
--
-- Bootstraps the catalog from the existing service_packages.metadata.streams,
-- now that the tables exist (P1-1). One-time backfill: after this, the catalog
-- is admin-managed. Idempotent (ON CONFLICT DO NOTHING).
--
-- Model decisions baked in here:
--   * Entitlement is SERVICE-level. package_services links a package to the
--     services it includes; each service carries the UNION of items seen for
--     it across all packages. (So item differences between tiers are flattened
--     onto the service's single menu.)
--   * Only stream keys that match a registry service are seeded. "Office"
--     appears as a stream in premium/premium-plus but has no provider, so it
--     is not in the registry and is intentionally skipped here.
--   * Dependencies are NOT seeded — the source data encodes none; they are
--     added by admins (P1-6/P1-7).

-- ─── package_services: link each package to its matching services ────────────
INSERT INTO public.package_services (package_id, service_id)
SELECT DISTINCT sp.id, s.id
FROM public.service_packages sp
CROSS JOIN LATERAL jsonb_object_keys(sp.metadata -> 'streams') AS stream_key
JOIN public.services s ON s.key = stream_key
WHERE sp.metadata ? 'streams'
ON CONFLICT (package_id, service_id) DO NOTHING;

-- ─── catalog_items: union of items per service ───────────────────────────────
INSERT INTO public.catalog_items (service_id, item_key, label)
SELECT service_id, item_key, min(label) AS label
FROM (
  SELECT
    s.id AS service_id,
    trim(BOTH '-' FROM lower(regexp_replace(item_value, '[^a-zA-Z0-9]+', '-', 'g'))) AS item_key,
    trim(item_value) AS label
  FROM public.service_packages sp
  CROSS JOIN LATERAL jsonb_object_keys(sp.metadata -> 'streams') AS stream_key
  JOIN public.services s ON s.key = stream_key
  CROSS JOIN LATERAL jsonb_array_elements_text(sp.metadata -> 'streams' -> stream_key) AS item_value
  WHERE sp.metadata ? 'streams'
    AND length(trim(item_value)) > 0
) expanded
WHERE item_key <> ''
GROUP BY service_id, item_key
ON CONFLICT (service_id, item_key) DO NOTHING;

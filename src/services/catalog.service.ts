import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Catalog read layer (Phase 1, P1-5)
//
// Read/query functions over the catalog config tables. Powers the admin
// config UI (P1-7) now, and is reused by the customer selection menu in
// Phase 2. All functions take an admin SupabaseClient so they can run from
// server-side API routes.

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CatalogItemRow = Database["public"]["Tables"]["catalog_items"]["Row"];
type CatalogItemDependencyRow =
  Database["public"]["Tables"]["catalog_item_dependencies"]["Row"];

export type Service = Pick<
  ServiceRow,
  "id" | "key" | "name" | "description" | "is_active"
>;

export type CatalogItem = Pick<
  CatalogItemRow,
  "id" | "service_id" | "item_key" | "label" | "description" | "is_active"
>;

export type CatalogItemDependency = Pick<
  CatalogItemDependencyRow,
  "id" | "catalog_item_id" | "depends_on_item_id"
>;

/** A service together with the catalog items it exposes — the entitled menu shape. */
export interface ServiceWithItems {
  id: string;
  key: string;
  name: string;
  items: Array<Pick<CatalogItem, "id" | "item_key" | "label" | "description">>;
}

export async function listServices(
  admin: SupabaseClient,
  options: { includeInactive?: boolean } = {},
): Promise<Service[]> {
  let query = admin
    .from("services")
    .select("id, key, name, description, is_active")
    .order("name", { ascending: true });

  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Service[];
}

export async function listCatalogItems(
  admin: SupabaseClient,
  options: { serviceId?: string; includeInactive?: boolean } = {},
): Promise<CatalogItem[]> {
  let query = admin
    .from("catalog_items")
    .select("id, service_id, item_key, label, description, is_active")
    .order("label", { ascending: true });

  if (options.serviceId) {
    query = query.eq("service_id", options.serviceId);
  }
  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogItem[];
}

export async function listCatalogItemDependencies(
  admin: SupabaseClient,
): Promise<CatalogItemDependency[]> {
  const { data, error } = await admin
    .from("catalog_item_dependencies")
    .select("id, catalog_item_id, depends_on_item_id");

  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogItemDependency[];
}

/** Service ids included in a package (active links only). */
export async function listPackageServiceIds(
  admin: SupabaseClient,
  packageId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("package_services")
    .select("service_id")
    .eq("package_id", packageId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.service_id as string);
}

/**
 * The entitled menu for a package: the active services it includes, each with
 * its active catalog items. This is the deterministic menu the customer picks
 * from in Phase 2, and what the admin UI renders per package.
 */
export async function getPackageCatalog(
  admin: SupabaseClient,
  packageId: string,
): Promise<ServiceWithItems[]> {
  const serviceIds = await listPackageServiceIds(admin, packageId);
  if (serviceIds.length === 0) return [];

  const [servicesRes, itemsRes] = await Promise.all([
    admin
      .from("services")
      .select("id, key, name")
      .in("id", serviceIds)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    admin
      .from("catalog_items")
      .select("id, service_id, item_key, label, description")
      .in("service_id", serviceIds)
      .eq("is_active", true)
      .order("label", { ascending: true }),
  ]);

  if (servicesRes.error) throw new Error(servicesRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);

  const itemsByService = new Map<
    string,
    Array<Pick<CatalogItem, "id" | "item_key" | "label" | "description">>
  >();
  for (const item of itemsRes.data ?? []) {
    const list = itemsByService.get(item.service_id as string) ?? [];
    list.push({
      id: item.id as string,
      item_key: item.item_key as string,
      label: item.label as string,
      description: (item.description as string | null) ?? null,
    });
    itemsByService.set(item.service_id as string, list);
  }

  return (servicesRes.data ?? []).map((service) => ({
    id: service.id as string,
    key: service.key as string,
    name: service.name as string,
    items: itemsByService.get(service.id as string) ?? [],
  }));
}

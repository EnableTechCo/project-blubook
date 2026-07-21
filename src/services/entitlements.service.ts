import type { AppSupabaseClient as SupabaseClient } from "@/lib/supabase/types";
import {
  getPackageCatalog,
  listCatalogItemDependencies,
  listCatalogItems,
  listServices,
  type CatalogItemDependency,
  type ServiceWithItems,
} from "@/services/catalog.service";

// Customer entitlement resolver (Phase 2, P2-3)
//
// Resolves what a customer may request: their organization's active
// subscription determines the package, the package determines the menu of
// services + items (via getPackageCatalog). Dependencies are returned in full
// (not just among menu items) because expansion can auto-include a prerequisite
// from a service the package does not itself sell (e.g. a Sales item that
// depends on a Logistics item).

export interface CustomerEntitlements {
  /** The customer's active package, or null if they have no active subscription. */
  packageId: string | null;
  /** The pickable menu: entitled services, each with its active items. */
  services: ServiceWithItems[];
  /** Full catalog dependency edges, so the closure engine (P2-4) can expand. */
  dependencies: CatalogItemDependency[];
}

const EMPTY: CustomerEntitlements = {
  packageId: null,
  services: [],
  dependencies: [],
};

/** The organization a customer belongs to, or null. */
async function resolveOrganizationId(
  admin: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("organization_id")
    .eq("user_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.organization_id as string | null) ?? null;
}

/** The package granted by the org's current (non-cancelled) subscription, or null. */
async function resolveActivePackageId(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("package_id")
    .eq("organization_id", organizationId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.package_id as string | null) ?? null;
}

export async function resolveCustomerEntitlements(
  admin: SupabaseClient,
  input: { customerId: string },
): Promise<CustomerEntitlements> {
  const organizationId = await resolveOrganizationId(admin, input.customerId);
  if (!organizationId) return EMPTY;

  const packageId = await resolveActivePackageId(admin, organizationId);
  if (!packageId) return EMPTY;

  const [services, dependencies] = await Promise.all([
    getPackageCatalog(admin, packageId),
    listCatalogItemDependencies(admin),
  ]);

  return { packageId, services, dependencies };
}

/** A catalog item's display info, used to label auto-included dependencies. */
export interface DirectoryItem {
  id: string;
  label: string;
  serviceName: string;
}

export interface CustomerWorkRequestMenu {
  hasSubscription: boolean;
  /** The pickable menu grouped by service. */
  services: ServiceWithItems[];
  /** Directed catalog dependency edges, for the client to preview the closure. */
  dependencies: CatalogItemDependency[];
  /**
   * Display info for every active item — including ones outside the menu — so
   * the review step can name any auto-included dependency the closure pulls in.
   */
  itemDirectory: DirectoryItem[];
}

/**
 * Everything the customer selection UI (P2-6) needs in one call: the entitled
 * menu, the dependency edges (so it can compute and disclose the auto-included
 * closure client-side), and a directory to label items the menu doesn't sell.
 */
export async function resolveCustomerWorkRequestMenu(
  admin: SupabaseClient,
  input: { customerId: string },
): Promise<CustomerWorkRequestMenu> {
  const entitlements = await resolveCustomerEntitlements(admin, input);
  if (!entitlements.packageId) {
    return {
      hasSubscription: false,
      services: [],
      dependencies: [],
      itemDirectory: [],
    };
  }

  const [allItems, allServices] = await Promise.all([
    listCatalogItems(admin),
    listServices(admin),
  ]);
  const serviceNameById = new Map(allServices.map((s) => [s.id, s.name]));
  const itemDirectory: DirectoryItem[] = allItems.map((item) => ({
    id: item.id,
    label: item.label,
    serviceName: serviceNameById.get(item.service_id) ?? "",
  }));

  return {
    hasSubscription: true,
    services: entitlements.services,
    dependencies: entitlements.dependencies,
    itemDirectory,
  };
}

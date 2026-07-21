import type { AppSupabaseClient as SupabaseClient } from "@/lib/supabase/types";
import { resolveCustomerEntitlements } from "@/services/entitlements.service";
import {
  resolveDependencyClosure,
  type DependencyEdge,
} from "@/features/catalog/dependency-graph";
import { planWorkRequestItems } from "@/features/catalog/work-request-plan";
import { notifyCustomer } from "@/services/work-request-notifications.service";

// Work-request creation (Phase 2, P2-5)
//
// Turns a customer's catalog selection into a persisted work-request graph:
// validates the picks against their entitlements, expands the selection along
// the dependency chain (auto-including + disclosing), materializes the parent,
// items, and instance dependency edges, and marks each item ready or blocked.

export interface AutoIncludedItem {
  catalogItemId: string;
  label: string;
  serviceName: string;
}

export interface CreateWorkRequestSuccess {
  ok: true;
  workRequestId: string;
  itemCount: number;
  readyCount: number;
  autoIncluded: AutoIncludedItem[];
}

export interface CreateWorkRequestFailure {
  ok: false;
  error: string;
  status: number;
}

export type CreateWorkRequestResult =
  | CreateWorkRequestSuccess
  | CreateWorkRequestFailure;

export async function createWorkRequest(
  admin: SupabaseClient,
  input: { customerId: string; selectedCatalogItemIds: string[] },
): Promise<CreateWorkRequestResult> {
  const selected = [...new Set(input.selectedCatalogItemIds)];
  if (selected.length === 0) {
    return { ok: false, error: "Select at least one work order.", status: 400 };
  }

  // 1. Entitlements — the customer's package menu + the catalog dependency edges.
  const entitlements = await resolveCustomerEntitlements(admin, {
    customerId: input.customerId,
  });
  if (!entitlements.packageId) {
    return {
      ok: false,
      error: "You have no active subscription to request work orders against.",
      status: 409,
    };
  }

  // 2. Validate the picks are items the package actually grants.
  const entitledItemIds = new Set(
    entitlements.services.flatMap((s) => s.items.map((i) => i.id)),
  );
  const notEntitled = selected.filter((id) => !entitledItemIds.has(id));
  if (notEntitled.length > 0) {
    return {
      ok: false,
      error: "Some selected work orders are not included in your package.",
      status: 400,
    };
  }

  // 3. Expand along the dependency chain (both directions), then plan.
  const edges: DependencyEdge[] = entitlements.dependencies.map((d) => ({
    catalogItemId: d.catalog_item_id,
    dependsOnItemId: d.depends_on_item_id,
  }));
  const closure = resolveDependencyClosure(selected, edges);

  // 4. Resolve service + label for every item in the closure (incl. auto-included
  //    ones outside the menu), plus the customer's organization.
  const [itemsRes, orgRes] = await Promise.all([
    admin
      .from("catalog_items")
      .select("id, service_id, label")
      .in("id", closure.allIds),
    admin
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", input.customerId)
      .maybeSingle(),
  ]);

  if (itemsRes.error) {
    return { ok: false, error: itemsRes.error.message, status: 500 };
  }

  const itemRows = (itemsRes.data ?? []) as Array<{
    id: string;
    service_id: string;
    label: string;
  }>;
  const serviceIdByItem = new Map(itemRows.map((r) => [r.id, r.service_id]));
  const labelByItem = new Map(itemRows.map((r) => [r.id, r.label]));

  if (serviceIdByItem.size !== closure.allIds.length) {
    return {
      ok: false,
      error: "The catalog is inconsistent — a required item is missing.",
      status: 500,
    };
  }

  const serviceIds = [...new Set(itemRows.map((r) => r.service_id))];
  const { data: serviceRows, error: servicesError } = await admin
    .from("services")
    .select("id, name")
    .in("id", serviceIds);
  if (servicesError) {
    return { ok: false, error: servicesError.message, status: 500 };
  }
  const serviceNameById = new Map(
    (serviceRows ?? []).map((r) => [r.id as string, r.name as string]),
  );

  const organizationId =
    (orgRes.data?.organization_id as string | null) ?? null;

  const plan = planWorkRequestItems(closure, edges, serviceIdByItem);

  // 5. Persist: parent -> items -> instance dependency edges. On any post-parent
  //    failure, delete the parent (cascade cleans items/deps) so we never leave
  //    a half-built request.
  const { data: parent, error: parentError } = await admin
    .from("work_requests")
    .insert({
      organization_id: organizationId,
      customer_id: input.customerId,
      package_id: entitlements.packageId,
      status: "active",
    })
    .select("id")
    .single();

  if (parentError || !parent) {
    return {
      ok: false,
      error: parentError?.message ?? "Could not create the request.",
      status: 500,
    };
  }
  const workRequestId = parent.id as string;

  const rollback = async () => {
    await admin.from("work_requests").delete().eq("id", workRequestId);
  };

  const { data: insertedItems, error: itemsInsertError } = await admin
    .from("work_request_items")
    .insert(
      plan.items.map((item) => ({
        work_request_id: workRequestId,
        catalog_item_id: item.catalogItemId,
        service_id: item.serviceId,
        auto_included: item.autoIncluded,
        status: item.status,
      })),
    )
    .select("id, catalog_item_id");

  if (itemsInsertError || !insertedItems) {
    await rollback();
    return {
      ok: false,
      error: itemsInsertError?.message ?? "Could not create work orders.",
      status: 500,
    };
  }

  const itemIdByCatalog = new Map(
    insertedItems.map((row) => [row.catalog_item_id, row.id]),
  );

  if (plan.dependencies.length > 0) {
    const dependencyRows = plan.dependencies.map((dependency) => ({
      work_request_item_id: itemIdByCatalog.get(dependency.catalogItemId),
      depends_on_item_id: itemIdByCatalog.get(dependency.dependsOnItemId),
    }));

    const resolvedDependencyRows = dependencyRows.filter(
      (
        row,
      ): row is {
        work_request_item_id: string;
        depends_on_item_id: string;
      } =>
        typeof row.work_request_item_id === "string" &&
        typeof row.depends_on_item_id === "string",
    );

    if (resolvedDependencyRows.length !== dependencyRows.length) {
      await rollback();
      return {
        ok: false,
        error: "Could not resolve one or more work request dependencies.",
        status: 500,
      };
    }

    const { error: depsError } = await admin
      .from("work_request_item_dependencies")
      .insert(resolvedDependencyRows);
    if (depsError) {
      await rollback();
      return { ok: false, error: depsError.message, status: 500 };
    }
  }

  const autoIncluded = closure.autoIncludedIds.map((id) => ({
    catalogItemId: id,
    label: labelByItem.get(id) ?? "",
    serviceName: serviceNameById.get(serviceIdByItem.get(id) ?? "") ?? "",
  }));

  // Disclose the expansion (P4-3). One summary for what the system added, then
  // a queued notice only for the items the customer picked themselves — the
  // auto-included ones are already covered by the summary, so per-item notices
  // for them would just be noise.
  if (autoIncluded.length > 0) {
    await notifyCustomer(admin, {
      workRequestId,
      event: "work_orders_auto_added",
      itemCount: autoIncluded.length,
    });
  }

  const selectedSet = new Set(selected);
  const blockedSelections = plan.items.filter(
    (i) => i.status === "blocked" && selectedSet.has(i.catalogItemId),
  );
  for (const item of blockedSelections) {
    const prerequisite = plan.dependencies.find(
      (d) => d.catalogItemId === item.catalogItemId,
    );
    await notifyCustomer(admin, {
      workRequestId,
      event: "work_order_queued",
      workRequestItemId: itemIdByCatalog.get(item.catalogItemId),
      label: labelByItem.get(item.catalogItemId),
      blockedByLabel: prerequisite
        ? labelByItem.get(prerequisite.dependsOnItemId)
        : undefined,
    });
  }

  return {
    ok: true,
    workRequestId,
    itemCount: plan.items.length,
    readyCount: plan.items.filter((i) => i.status === "ready").length,
    autoIncluded,
  };
}

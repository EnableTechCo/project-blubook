import type { AppSupabaseClient as SupabaseClient } from "@/lib/supabase/types";

// Provider work-order execution (Phase 3, P3-5)
//
// What a provider sees and can do with the work routed to them.
//
// Anonymity is the constraint that shapes this file: a provider is told what
// the work is and which service it belongs to, and nothing about who asked
// for it. No organization, no customer, and no work_request_id — the parent id
// would let a provider group items and infer that one customer is behind them.
// Items are identified by an opaque reference derived from their own id.

export interface ProviderWorkOrder {
  id: string;
  /** Short opaque handle for support conversations — reveals no customer. */
  reference: string;
  label: string;
  description: string | null;
  serviceName: string;
  status: "assigned" | "in_progress" | "completed";
  releasedAt: string | null;
  completedAt: string | null;
}

/** Work orders currently routed to this provider, newest release first. */
export async function listProviderWorkOrders(
  admin: SupabaseClient,
  input: { providerId: string; includeCompleted?: boolean },
): Promise<ProviderWorkOrder[]> {
  const statuses = input.includeCompleted
    ? ["assigned", "in_progress", "completed"]
    : ["assigned", "in_progress"];

  const { data: rows, error } = await admin
    .from("work_request_items")
    .select("id, catalog_item_id, service_id, status, released_at, completed_at")
    .eq("assigned_provider_id", input.providerId)
    .in("status", statuses)
    .order("released_at", { ascending: false });
  if (error) throw new Error(error.message);

  const items = (rows ?? []) as Array<{
    id: string;
    catalog_item_id: string;
    service_id: string;
    status: string;
    released_at: string | null;
    completed_at: string | null;
  }>;
  if (items.length === 0) return [];

  const [catalogRes, servicesRes] = await Promise.all([
    admin
      .from("catalog_items")
      .select("id, label, description")
      .in("id", [...new Set(items.map((i) => i.catalog_item_id))]),
    admin
      .from("services")
      .select("id, name")
      .in("id", [...new Set(items.map((i) => i.service_id))]),
  ]);
  if (catalogRes.error) throw new Error(catalogRes.error.message);
  if (servicesRes.error) throw new Error(servicesRes.error.message);

  const catalogById = new Map(
    (
      (catalogRes.data ?? []) as Array<{
        id: string;
        label: string;
        description: string | null;
      }>
    ).map((r) => [r.id, r]),
  );
  const serviceNameById = new Map(
    ((servicesRes.data ?? []) as Array<{ id: string; name: string }>).map(
      (r) => [r.id, r.name],
    ),
  );

  return items.map((item) => {
    const catalog = catalogById.get(item.catalog_item_id);
    return {
      id: item.id,
      reference: item.id.slice(0, 8).toUpperCase(),
      label: catalog?.label ?? "Work order",
      description: catalog?.description ?? null,
      serviceName: serviceNameById.get(item.service_id) ?? "",
      status: item.status as ProviderWorkOrder["status"],
      releasedAt: item.released_at,
      completedAt: item.completed_at,
    };
  });
}

export interface AcceptResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * Provider accepts an assigned work order and starts work.
 *
 * Scoped to the assigned provider so one provider cannot pick up another's
 * work, and guarded on the current status so accepting twice is rejected
 * rather than silently re-starting an in-flight item.
 */
export async function acceptWorkOrderItem(
  admin: SupabaseClient,
  input: { workRequestItemId: string; expectedProviderId: string },
): Promise<AcceptResult> {
  const { data: item, error } = await admin
    .from("work_request_items")
    .select("id, status, assigned_provider_id")
    .eq("id", input.workRequestItemId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 500 };
  if (!item) return { ok: false, error: "Work order not found.", status: 404 };

  if (item.assigned_provider_id !== input.expectedProviderId) {
    return {
      ok: false,
      error: "This work order is not assigned to you.",
      status: 403,
    };
  }
  if (item.status !== "assigned") {
    return {
      ok: false,
      error:
        item.status === "in_progress"
          ? "You have already accepted this work order."
          : "This work order cannot be accepted.",
      status: 409,
    };
  }

  const { error: updateError } = await admin
    .from("work_request_items")
    .update({ status: "in_progress" })
    .eq("id", input.workRequestItemId)
    .eq("status", "assigned");
  if (updateError) {
    return { ok: false, error: updateError.message, status: 500 };
  }

  return { ok: true };
}

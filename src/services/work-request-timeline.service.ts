import type { AppSupabaseClient as SupabaseClient } from "@/lib/supabase/types";
import {
  opaqueReference,
  providerLabel,
} from "@/features/notifications/anonymity";

// Per-request customer timeline (Phase 4, P4-4)
//
// The customer's window into their request. Every entry is derived from
// timestamps the engine already writes — created_at, released_at, completed_at
// — rather than from a parallel log. A stored timeline would be a second
// source of truth that can drift from the item states beside it; a derived one
// cannot, and it needs no new write path or migration.
//
// Anonymity is preserved by omission: the provider is never selected from the
// database here, so no query result carries a name to leak. Work in progress
// is attributed to "your <service> provider" via the P4-2 boundary.

export type TimelineEntryKind =
  | "requested"
  | "auto_added"
  | "queued"
  | "started"
  | "completed"
  | "request_completed";

export interface TimelineEntry {
  at: string;
  kind: TimelineEntryKind;
  message: string;
  /** The work order this entry concerns, if any. */
  itemLabel?: string;
}

export interface TimelineItem {
  label: string;
  serviceName: string;
  status: string;
  autoIncluded: boolean;
  blockedByLabel: string | null;
}

export interface WorkRequestTimeline {
  reference: string;
  status: string;
  createdAt: string;
  itemCount: number;
  completedCount: number;
  items: TimelineItem[];
  entries: TimelineEntry[];
}

export type TimelineResult =
  | { ok: true; timeline: WorkRequestTimeline }
  | { ok: false; error: string; status: number };

export interface WorkRequestSummary {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  itemCount: number;
  completedCount: number;
}

/**
 * The customer's own requests, newest first.
 *
 * Scoped to the caller's customer_id, and carries no provider information —
 * the summary exists to get someone to a timeline, not to describe who is
 * doing the work.
 */
export async function listCustomerWorkRequests(
  admin: SupabaseClient,
  input: { customerId: string; limit?: number },
): Promise<WorkRequestSummary[]> {
  const { data: requestRows, error } = await admin
    .from("work_requests")
    .select("id, status, created_at")
    .eq("customer_id", input.customerId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20);
  if (error) throw new Error(error.message);

  const requests = (requestRows ?? []) as Array<{
    id: string;
    status: string;
    created_at: string;
  }>;
  if (requests.length === 0) return [];

  const { data: itemRows, error: itemsError } = await admin
    .from("work_request_items")
    .select("work_request_id, status")
    .in(
      "work_request_id",
      requests.map((r) => r.id),
    );
  if (itemsError) throw new Error(itemsError.message);

  const totals = new Map<string, { total: number; completed: number }>();
  for (const row of (itemRows ?? []) as Array<{
    work_request_id: string;
    status: string;
  }>) {
    const tally = totals.get(row.work_request_id) ?? { total: 0, completed: 0 };
    tally.total += 1;
    if (row.status === "completed") tally.completed += 1;
    totals.set(row.work_request_id, tally);
  }

  return requests.map((r) => ({
    id: r.id,
    reference: opaqueReference(r.id, "REQ"),
    status: r.status,
    createdAt: r.created_at,
    itemCount: totals.get(r.id)?.total ?? 0,
    completedCount: totals.get(r.id)?.completed ?? 0,
  }));
}

export async function getWorkRequestTimeline(
  admin: SupabaseClient,
  input: { workRequestId: string; customerId: string },
): Promise<TimelineResult> {
  const { data: request, error } = await admin
    .from("work_requests")
    .select("id, customer_id, status, created_at, updated_at")
    .eq("id", input.workRequestId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 500 };
  if (!request) return { ok: false, error: "Request not found.", status: 404 };

  // A customer may only look at their own request.
  if (request.customer_id !== input.customerId) {
    return { ok: false, error: "Request not found.", status: 404 };
  }

  const { data: itemRows, error: itemsError } = await admin
    .from("work_request_items")
    // Deliberately no assigned_provider_id: it is not needed to render the
    // timeline, and not selecting it means it cannot reach the client.
    .select(
      "id, catalog_item_id, service_id, status, auto_included, created_at, released_at, completed_at",
    )
    .eq("work_request_id", input.workRequestId);
  if (itemsError) return { ok: false, error: itemsError.message, status: 500 };

  const items = (itemRows ?? []) as Array<{
    id: string;
    catalog_item_id: string;
    service_id: string;
    status: string;
    auto_included: boolean;
    created_at: string;
    released_at: string | null;
    completed_at: string | null;
  }>;

  const [catalogRes, servicesRes, depsRes] = await Promise.all([
    admin
      .from("catalog_items")
      .select("id, label")
      .in("id", [...new Set(items.map((i) => i.catalog_item_id))]),
    admin
      .from("services")
      .select("id, name")
      .in("id", [...new Set(items.map((i) => i.service_id))]),
    admin
      .from("work_request_item_dependencies")
      .select("work_request_item_id, depends_on_item_id")
      .in("work_request_item_id", items.map((i) => i.id)),
  ]);

  const labelByCatalog = new Map(
    ((catalogRes.data ?? []) as Array<{ id: string; label: string }>).map((r) => [
      r.id,
      r.label,
    ]),
  );
  const serviceNameById = new Map(
    ((servicesRes.data ?? []) as Array<{ id: string; name: string }>).map((r) => [
      r.id,
      r.name,
    ]),
  );

  const labelOf = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    return item ? labelByCatalog.get(item.catalog_item_id) ?? "Work order" : null;
  };

  const prerequisiteOf = new Map<string, string>();
  for (const dep of (depsRes.data ?? []) as Array<{
    work_request_item_id: string;
    depends_on_item_id: string;
  }>) {
    if (!prerequisiteOf.has(dep.work_request_item_id)) {
      prerequisiteOf.set(dep.work_request_item_id, dep.depends_on_item_id);
    }
  }

  const entries: TimelineEntry[] = [
    {
      at: request.created_at,
      kind: "requested",
      message: "You submitted this request.",
    },
  ];

  const autoAdded = items.filter((i) => i.auto_included);
  if (autoAdded.length > 0) {
    entries.push({
      at: request.created_at,
      kind: "auto_added",
      message:
        autoAdded.length === 1
          ? "1 required step was added so your selection can be completed."
          : `${autoAdded.length} required steps were added so your selection can be completed.`,
    });
  }

  const timelineItems: TimelineItem[] = [];

  for (const item of items) {
    const label = labelByCatalog.get(item.catalog_item_id) ?? "Work order";
    const serviceName = serviceNameById.get(item.service_id) ?? "";
    const blockingId = prerequisiteOf.get(item.id);
    const blockedByLabel = blockingId ? labelOf(blockingId) : null;

    timelineItems.push({
      label,
      serviceName,
      status: item.status,
      autoIncluded: item.auto_included,
      blockedByLabel: item.status === "blocked" ? blockedByLabel : null,
    });

    if (item.status === "blocked" && blockedByLabel) {
      entries.push({
        at: item.created_at,
        kind: "queued",
        itemLabel: label,
        message: `"${label}" is queued — it starts once "${blockedByLabel}" is done.`,
      });
    }

    if (item.released_at) {
      entries.push({
        at: item.released_at,
        kind: "started",
        itemLabel: label,
        message: `Work started on "${label}" with ${providerLabel(serviceName)}.`,
      });
    }

    if (item.completed_at) {
      entries.push({
        at: item.completed_at,
        kind: "completed",
        itemLabel: label,
        message: `"${label}" was completed.`,
      });
    }
  }

  if (request.status === "completed") {
    entries.push({
      at: request.updated_at,
      kind: "request_completed",
      message: "All work orders in this request are complete.",
    });
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));

  return {
    ok: true,
    timeline: {
      reference: opaqueReference(request.id, "REQ"),
      status: request.status,
      createdAt: request.created_at,
      itemCount: items.length,
      completedCount: items.filter((i) => i.status === "completed").length,
      items: timelineItems,
      entries,
    },
  };
}

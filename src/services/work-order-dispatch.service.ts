import type { AppSupabaseClient as SupabaseClient } from "@/lib/supabase/types";
import {
  placementSeverity,
  selectProviderForWorkOrder,
  type PlacementBlockedReason,
  type ProviderCandidate,
} from "@/features/catalog/provider-router";
import { queueWorkflowEvent } from "@/lib/workflow/engine";

// Work-order dispatch (Phase 3, P3-3)
//
// Takes the items a work request has released (`ready`) and places each one
// with a provider: the load-balancing router (P3-1) picks who, the item is
// assigned, an engagement row is written to customer_provider_requests (the
// same layer the #44-47 flow uses), and a work_request.item_dispatched event
// is queued for the downstream notification handler.
//
// Items that cannot be placed are returned as `unplaced` and left `ready`, so
// a saturated service stalls one item instead of failing the whole request.
// The bottleneck guardrail (P3-6) consumes that signal.

export interface DispatchedItem {
  itemId: string;
  label: string;
  serviceName: string;
  providerId: string;
  providerName: string;
  score: number | null;
  reason: string;
}

export interface UnplacedItem {
  itemId: string;
  label: string;
  serviceName: string;
  reason: string;
  /** Why placement failed — drives the severity of the flagged risk. */
  blockedReason: PlacementBlockedReason;
}

export interface DispatchResult {
  dispatched: DispatchedItem[];
  unplaced: UnplacedItem[];
}

interface ReadyItemRow {
  id: string;
  service_id: string;
  catalog_item_id: string;
}

/**
 * Which of these providers have at least one user who can act for them.
 *
 * Resolved the same way `resolvePartnerUserIds` does — organization tagged
 * with the partner id, then profiles in that organization — so the router's
 * notion of "reachable" matches who would actually be notified.
 */
async function loadReachableProviderIds(
  admin: SupabaseClient,
  partnerIds: string[],
): Promise<Set<string>> {
  const reachable = new Set<string>();
  if (partnerIds.length === 0) return reachable;

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, metadata")
    .not("metadata->>service_partner_id", "is", null);
  if (error) throw new Error(error.message);

  const partnerIdByOrg = new Map<string, string>();
  for (const row of (orgs ?? []) as Array<{ id: string; metadata: unknown }>) {
    const metadata = (row.metadata ?? {}) as { service_partner_id?: unknown };
    const partnerId = metadata.service_partner_id;
    if (typeof partnerId === "string" && partnerIds.includes(partnerId)) {
      partnerIdByOrg.set(row.id, partnerId);
    }
  }
  if (partnerIdByOrg.size === 0) return reachable;

  const { data: profiles, error: profilesError } = await admin
    .from("user_profiles")
    .select("organization_id")
    .in("organization_id", [...partnerIdByOrg.keys()]);
  if (profilesError) throw new Error(profilesError.message);

  for (const row of (profiles ?? []) as Array<{
    organization_id: string | null;
  }>) {
    const partnerId = row.organization_id
      ? partnerIdByOrg.get(row.organization_id)
      : undefined;
    if (partnerId) reachable.add(partnerId);
  }

  return reachable;
}

/**
 * Build the routing signals for every provider registered against `streams`.
 *
 * Open load counts work this provider already holds; completions and failed
 * dispatches stand in for throughput and reliability. All three are read in
 * bulk so routing a batch costs a constant number of queries.
 */
async function loadProviderCandidates(
  admin: SupabaseClient,
  streams: string[],
): Promise<Map<string, ProviderCandidate[]>> {
  const byStream = new Map<string, ProviderCandidate[]>();
  if (streams.length === 0) return byStream;

  const { data: partners, error } = await admin
    .from("service_partners")
    .select("id, name, package_stream, is_active")
    .in("package_stream", streams);
  if (error) throw new Error(error.message);

  const partnerRows = (partners ?? []) as Array<{
    id: string;
    name: string;
    package_stream: string;
    is_active: boolean;
  }>;
  if (partnerRows.length === 0) return byStream;

  const partnerIds = partnerRows.map((p) => p.id);
  const reachable = await loadReachableProviderIds(admin, partnerIds);

  const [openRes, doneRes, failedRes] = await Promise.all([
    admin
      .from("work_request_items")
      .select("assigned_provider_id")
      .in("assigned_provider_id", partnerIds)
      .in("status", ["assigned", "in_progress"]),
    admin
      .from("work_request_items")
      .select("assigned_provider_id")
      .in("assigned_provider_id", partnerIds)
      .eq("status", "completed"),
    admin
      .from("customer_provider_requests")
      .select("provider_id")
      .in("provider_id", partnerIds)
      .eq("request_status", "failed"),
  ]);

  const tally = (
    rows: Array<Record<string, unknown>> | null,
    key: string,
  ): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      const id = row[key];
      if (typeof id !== "string") continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  };

  const openLoad = tally(openRes.data, "assigned_provider_id");
  const completions = tally(doneRes.data, "assigned_provider_id");
  const failures = tally(failedRes.data, "provider_id");

  for (const p of partnerRows) {
    const list = byStream.get(p.package_stream) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      isActive: p.is_active,
      hasReachableUsers: reachable.has(p.id),
      openLoad: openLoad.get(p.id) ?? 0,
      recentCompletions: completions.get(p.id) ?? 0,
      recentSlaBreaches: failures.get(p.id) ?? 0,
    });
    byStream.set(p.package_stream, list);
  }

  return byStream;
}

/** anomaly_alerts discriminator for an item routing could not place. */
export const UNPLACED_ANOMALY_TYPE = "work_order_unplaced";

/**
 * Surface an unplaceable item as a flagged risk (P3-6).
 *
 * Without this the item just stays `ready` and the dependency chain stalls
 * with nobody told. It is written to anomaly_alerts, which the admin
 * anomalies view already reads, and is non-fatal: failing to raise the flag
 * must not break the dispatch of the other items in the batch.
 */
async function flagUnplacedItem(
  admin: SupabaseClient,
  input: {
    itemId: string;
    label: string;
    serviceName: string;
    reason: string;
    blockedReason: PlacementBlockedReason;
  },
): Promise<void> {
  try {
    // One open flag per item — re-running dispatch must not pile up duplicates.
    const { data: existing } = await admin
      .from("anomaly_alerts")
      .select("id")
      .eq("anomaly_type", UNPLACED_ANOMALY_TYPE)
      .eq("source_entity_id", input.itemId)
      .eq("status", "pending_review")
      .maybeSingle();
    if (existing) return;

    const { error } = await admin.from("anomaly_alerts").insert({
      // `area` is constrained to orders|inventory|onboarding|workflow.
      area: "workflow",
      anomaly_type: UNPLACED_ANOMALY_TYPE,
      severity: placementSeverity(input.blockedReason),
      status: "pending_review",
      source_entity_type: "work_request_item",
      source_entity_id: input.itemId,
      source_label: `${input.label} (${input.serviceName})`,
      reason: input.reason,
      is_example: false,
    });
    if (error) {
      console.error(
        "[work-order-dispatch] Failed to flag unplaced item:",
        error.message,
      );
    }
  } catch (err) {
    console.error(
      "[work-order-dispatch] Unexpected error flagging unplaced item:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Route and dispatch every `ready` item on a work request.
 *
 * Safe to call repeatedly: only `ready` items are considered, and each one is
 * flipped to `assigned` as it is placed, so a re-run dispatches nothing twice.
 */
export async function dispatchReadyItems(
  admin: SupabaseClient,
  input: { workRequestId: string },
): Promise<DispatchResult> {
  const { data: parent, error: parentError } = await admin
    .from("work_requests")
    .select("id, organization_id, package_id")
    .eq("id", input.workRequestId)
    .single();
  if (parentError || !parent) {
    throw new Error(parentError?.message ?? "Work request not found.");
  }

  // The engagement layer is keyed by organization, so a request raised without
  // one (customer with no profile organization) cannot be dispatched.
  const organizationId = parent.organization_id;
  if (!organizationId) {
    throw new Error(
      "This work request has no organization, so it cannot be dispatched to providers.",
    );
  }

  const { data: items, error: itemsError } = await admin
    .from("work_request_items")
    .select("id, service_id, catalog_item_id")
    .eq("work_request_id", input.workRequestId)
    .eq("status", "ready");
  if (itemsError) throw new Error(itemsError.message);

  const readyItems = (items ?? []) as ReadyItemRow[];
  if (readyItems.length === 0) return { dispatched: [], unplaced: [] };

  // Resolve the service (whose `key` is the provider's package_stream) and a
  // human label for each item, for the response and the engagement row.
  const [servicesRes, labelsRes] = await Promise.all([
    admin
      .from("services")
      .select("id, key, name")
      .in("id", [...new Set(readyItems.map((i) => i.service_id))]),
    admin
      .from("catalog_items")
      .select("id, label")
      .in("id", [...new Set(readyItems.map((i) => i.catalog_item_id))]),
  ]);
  if (servicesRes.error) throw new Error(servicesRes.error.message);
  if (labelsRes.error) throw new Error(labelsRes.error.message);

  const serviceById = new Map(
    ((servicesRes.data ?? []) as Array<{ id: string; key: string; name: string }>).map(
      (s) => [s.id, s],
    ),
  );
  const labelById = new Map(
    ((labelsRes.data ?? []) as Array<{ id: string; label: string }>).map((r) => [
      r.id,
      r.label,
    ]),
  );

  const candidatesByStream = await loadProviderCandidates(
    admin,
    [...new Set([...serviceById.values()].map((s) => s.key))],
  );

  const dispatched: DispatchedItem[] = [];
  const unplaced: UnplacedItem[] = [];

  for (const item of readyItems) {
    const service = serviceById.get(item.service_id);
    const serviceName = service?.name ?? "Unknown service";
    const label = labelById.get(item.catalog_item_id) ?? "Work order";
    const candidates = service ? candidatesByStream.get(service.key) ?? [] : [];

    const selection = selectProviderForWorkOrder({ serviceName, candidates });

    if (!selection.providerId) {
      const blockedReason = selection.blockedReason ?? "all_unavailable";
      unplaced.push({
        itemId: item.id,
        label,
        serviceName,
        reason: selection.reason,
        blockedReason,
      });
      await flagUnplacedItem(admin, {
        itemId: item.id,
        label,
        serviceName,
        reason: selection.reason,
        blockedReason,
      });
      continue;
    }

    const { error: assignError } = await admin
      .from("work_request_items")
      .update({
        assigned_provider_id: selection.providerId,
        status: "assigned",
        released_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("status", "ready"); // guard against a concurrent dispatch
    if (assignError) throw new Error(assignError.message);

    // Engagement layer — the same table the #44-47 provider flow reads.
    const { data: engagement, error: engagementError } = await admin
      .from("customer_provider_requests")
      .insert({
        organization_id: organizationId,
        package_id: parent.package_id,
        package_stream: service?.key ?? serviceName,
        provider_id: selection.providerId,
        request_status: "sent",
        metadata: {
          source: "work_order_dispatch",
          work_request_id: input.workRequestId,
          work_request_item_id: item.id,
          work_order_label: label,
          provider_name: selection.providerName,
          routing_score: selection.score,
          routing_reason: selection.reason,
        },
      })
      .select("id")
      .single();
    if (engagementError) throw new Error(engagementError.message);

    // Charge the winner so the rest of this batch balances across providers
    // instead of piling onto the same least-loaded one.
    const winner = candidates.find((c) => c.id === selection.providerId);
    if (winner) winner.openLoad += 1;

    // Side-effect only: a queue failure must not undo a completed assignment.
    try {
      await queueWorkflowEvent("work_request.item_dispatched", {
        workRequestId: input.workRequestId,
        workRequestItemId: item.id,
        engagementRequestId: engagement.id,
        providerId: selection.providerId,
      });
    } catch (err) {
      console.error(
        "[work-order-dispatch] Failed to queue dispatch event:",
        err instanceof Error ? err.message : err,
      );
    }

    dispatched.push({
      itemId: item.id,
      label,
      serviceName,
      providerId: selection.providerId,
      providerName: selection.providerName,
      score: selection.score,
      reason: selection.reason,
    });
  }

  return { dispatched, unplaced };
}

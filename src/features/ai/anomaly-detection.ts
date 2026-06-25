import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnomalyArea = "orders" | "inventory" | "onboarding" | "workflow";
export type AnomalySeverity = "low" | "medium" | "high";

export interface DetectedAnomaly {
  area: AnomalyArea;
  anomalyType: string;
  severity: AnomalySeverity;
  reason: string;
  sourceEntityType: string;
  sourceEntityId?: string;
  sourceLabel: string;
}

// ─── Detection rules ──────────────────────────────────────────────────────────

// TODO: replace each detection function body with a real LLM API call.
// Expected interface:
//   POST /api/ai/anomalies/detect
//   body: { area: AnomalyArea, records: unknown[] }
//   response: { anomalies: DetectedAnomaly[] }

const STALL_THRESHOLD_HOURS = 48;
const RAPID_CYCLE_THRESHOLD_MINUTES = 5;

export async function detectOrderAnomalies(
  admin: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  // ── Rule 1: Duplicate PO references ────────────────────────────────────────
  const { data: orders } = await admin
    .from("sales_orders")
    .select("id, po_reference, organization_id, created_at")
    .not("po_reference", "is", null)
    .order("po_reference");

  if (orders) {
    const seen = new Map<string, { id: string; createdAt: string }>();
    for (const order of orders) {
      const ref = (order.po_reference as string | null)?.trim() ?? "";
      if (!ref) continue;
      const prev = seen.get(ref);
      if (prev) {
        const diffMs =
          new Date(order.created_at as string).getTime() -
          new Date(prev.createdAt).getTime();
        const diffMins = diffMs / 60_000;
        // Only flag if both orders were created within 60 minutes of each other
        if (diffMins <= 60) {
          anomalies.push({
            area: "orders",
            anomalyType: "duplicate_po_reference",
            severity: "high",
            reason: `PO reference "${ref}" appears on two separate sales orders created within ${Math.round(diffMins)} minute(s) — likely a double-submission or browser retry.`,
            sourceEntityType: "sales_order",
            sourceEntityId: order.id as string,
            sourceLabel: `Sales Order ${ref}`,
          });
        }
      } else {
        seen.set(ref, { id: order.id as string, createdAt: order.created_at as string });
      }
    }
  }

  // ── Rule 2: Stalled orders ──────────────────────────────────────────────────
  const stallCutoff = new Date(
    Date.now() - STALL_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: stalledOrders } = await admin
    .from("sales_orders")
    .select("id, po_reference, status, updated_at")
    .lt("updated_at", stallCutoff)
    .not("status", "in", '("Delivered","Invoice Generated","Cancelled")')
    .limit(50);

  for (const order of stalledOrders ?? []) {
    const hoursStalled = Math.round(
      (Date.now() - new Date(order.updated_at as string).getTime()) /
        3_600_000,
    );
    const poRef = (order.po_reference as string | null) ?? (order.id as string);
    anomalies.push({
      area: "orders",
      anomalyType: "order_status_stalled",
      severity: hoursStalled > 96 ? "high" : "medium",
      reason: `Sales order has remained in "${order.status}" for ${hoursStalled} hours without advancing — exceeds the ${STALL_THRESHOLD_HOURS}-hour SLA threshold.`,
      sourceEntityType: "sales_order",
      sourceEntityId: order.id as string,
      sourceLabel: `Sales Order ${poRef}`,
    });
  }

  // ── Rule 3: Rapid status cycling ────────────────────────────────────────────
  // Detects orders whose updated_at is suspiciously close to created_at
  // while already being in a late-stage status, suggesting machine-speed replay.
  const { data: recentOrders } = await admin
    .from("sales_orders")
    .select("id, po_reference, status, created_at, updated_at")
    .in("status", ["Packaging", "Invoice Generated", "Pick Ticket Generated"])
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(50);

  for (const order of recentOrders ?? []) {
    const diffMins =
      (new Date(order.updated_at as string).getTime() -
        new Date(order.created_at as string).getTime()) /
      60_000;

    if (diffMins < RAPID_CYCLE_THRESHOLD_MINUTES) {
      const poRef = (order.po_reference as string | null) ?? (order.id as string);
      anomalies.push({
        area: "workflow",
        anomalyType: "rapid_status_cycling",
        severity: "medium",
        reason: `Sales order reached "${order.status}" within ${Math.round(diffMins)} minute(s) of creation — machine-speed progression suggests an automated script or misconfigured webhook replay.`,
        sourceEntityType: "sales_order",
        sourceEntityId: order.id as string,
        sourceLabel: `Sales Order ${poRef}`,
      });
    }
  }

  return anomalies;
}

export async function detectInventoryAnomalies(
  admin: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  // ── Rule: Negative net stock per SKU ────────────────────────────────────────
  const { data: movements } = await admin
    .from("inventory_movements")
    .select("sku, quantity");

  if (movements) {
    const stockBySku = new Map<string, number>();
    for (const row of movements) {
      const sku = row.sku as string;
      stockBySku.set(sku, (stockBySku.get(sku) ?? 0) + (row.quantity as number));
    }

    for (const [sku, level] of stockBySku.entries()) {
      if (level < 0) {
        anomalies.push({
          area: "inventory",
          anomalyType: "negative_stock_detected",
          severity: "high",
          reason: `SKU "${sku}" shows a net stock level of ${level} units — stock was over-allocated before restoration completed.`,
          sourceEntityType: "inventory_sku",
          sourceLabel: `SKU ${sku}`,
        });
      }
    }
  }

  return anomalies;
}

export async function detectOnboardingDuplicates(
  admin: SupabaseClient,
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  // ── Rule: Duplicate organisation names within 24h ───────────────────────────
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, created_at")
    .gte("created_at", cutoff)
    .order("name");

  if (orgs) {
    const seen = new Map<string, string>();
    for (const org of orgs) {
      const key = (org.name as string).toLowerCase().trim();
      const prevId = seen.get(key);
      if (prevId) {
        anomalies.push({
          area: "onboarding",
          anomalyType: "duplicate_organization_name",
          severity: "medium",
          reason: `Organisation name "${org.name}" was registered twice within 24 hours — possible duplicate account creation.`,
          sourceEntityType: "organization",
          sourceEntityId: org.id as string,
          sourceLabel: org.name as string,
        });
      } else {
        seen.set(key, org.id as string);
      }
    }
  }

  return anomalies;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function persistAnomalies(
  admin: SupabaseClient,
  anomalies: DetectedAnomaly[],
): Promise<void> {
  if (anomalies.length === 0) return;

  const rows = anomalies.map((a) => ({
    area: a.area,
    anomaly_type: a.anomalyType,
    severity: a.severity,
    reason: a.reason,
    source_entity_type: a.sourceEntityType,
    source_entity_id: a.sourceEntityId ?? null,
    source_label: a.sourceLabel,
    is_example: false,
    status: "pending_review",
  }));

  const { error } = await admin.from("anomaly_alerts").insert(rows);

  if (error) {
    console.error("[anomaly-detection] Failed to persist anomalies:", error.message);
  }
}

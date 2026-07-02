import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlaRiskLevel = "low" | "medium" | "high";

export interface SlaRiskItem {
  orderId: string;
  poReference: string;
  status: string;
  organizationId: string;
  riskLevel: SlaRiskLevel;
  reason: string;
  suggestedAction: string;
  hoursElapsed: number;
  hoursRemaining: number;
  slaTargetHours: number;
}

// ─── Detection ────────────────────────────────────────────────────────────────

// TODO: replace this function body with a real LLM API call.
// Expected interface:
//   POST /api/ai/sla/predict-breach-risk
//   body: { items: { orderId: string, status: string, createdAt: string }[] }
//   response: { risks: SlaRiskItem[] }

// Terminal statuses are excluded — an order that has already completed or
// been cancelled has no further SLA risk to track.
const TERMINAL_STATUSES = new Set(["Delivered", "Invoice Generated", "Cancelled"]);

const SLA_TARGET_HOURS = 72;
const MEDIUM_RISK_RATIO = 0.5;
const HIGH_RISK_RATIO = 0.85;

function computeRiskLevel(ratio: number): SlaRiskLevel {
  if (ratio >= HIGH_RISK_RATIO) return "high";
  if (ratio >= MEDIUM_RISK_RATIO) return "medium";
  return "low";
}

function suggestedActionFor(level: SlaRiskLevel): string {
  if (level === "high") {
    return "Escalate immediately — assign an owner and confirm the blocking dependency.";
  }
  if (level === "medium") {
    return "Confirm the current owner and expected completion time.";
  }
  return "No action needed — order is on track.";
}

function reasonFor(status: string, hoursElapsed: number, ratio: number): string {
  const pct = Math.round(ratio * 100);
  const roundedHours = Math.round(hoursElapsed);

  if (ratio >= 1) {
    return `Order has been in "${status}" for ${roundedHours} hours — the ${SLA_TARGET_HOURS}-hour SLA window has already been exceeded.`;
  }

  return `Order has been in "${status}" for ${roundedHours} hours — ${pct}% of the ${SLA_TARGET_HOURS}-hour SLA window has elapsed.`;
}

interface RawSalesOrder {
  id: string;
  po_reference: string | null;
  status: string;
  organization_id: string;
  created_at: string;
}

export function computeSlaRisk(order: RawSalesOrder): SlaRiskItem {
  const hoursElapsed =
    (Date.now() - new Date(order.created_at).getTime()) / 3_600_000;
  const ratio = hoursElapsed / SLA_TARGET_HOURS;
  const riskLevel = computeRiskLevel(ratio);

  return {
    orderId: order.id,
    poReference: order.po_reference ?? order.id,
    status: order.status,
    organizationId: order.organization_id,
    riskLevel,
    reason: reasonFor(order.status, hoursElapsed, ratio),
    suggestedAction: suggestedActionFor(riskLevel),
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    hoursRemaining: Math.round((SLA_TARGET_HOURS - hoursElapsed) * 10) / 10,
    slaTargetHours: SLA_TARGET_HOURS,
  };
}

const RISK_SORT_WEIGHT: Record<SlaRiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export async function detectSlaRisks(
  admin: SupabaseClient,
): Promise<SlaRiskItem[]> {
  const { data: orders, error } = await admin
    .from("sales_orders")
    .select("id, po_reference, status, organization_id, created_at")
    .not("status", "in", `(${[...TERMINAL_STATUSES].map((s) => `"${s}"`).join(",")})`)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  const risks = (orders ?? []).map((order) =>
    computeSlaRisk(order as RawSalesOrder),
  );

  risks.sort((a, b) => {
    const weightDiff = RISK_SORT_WEIGHT[b.riskLevel] - RISK_SORT_WEIGHT[a.riskLevel];
    if (weightDiff !== 0) return weightDiff;
    return b.hoursElapsed - a.hoursElapsed;
  });

  return risks;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingAutomationSignals } from "./onboarding-intelligence";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnomalySeverity = "low" | "medium" | "high";

export interface OnboardingAnomaly {
  anomalyType: string;
  reason: string;
  severity: AnomalySeverity;
}

// ─── Detection rules ──────────────────────────────────────────────────────────

/**
 * Runs all anomaly detection rules against a completed onboarding submission.
 * Returns every anomaly found; an empty array means the submission is clean.
 * This is pure logic — no side effects, no I/O.
 */
export function detectOnboardingAnomalies(
  onboarding: OnboardingAutomationSignals,
  packageTier: string,
  confidenceScore: number,
): OnboardingAnomaly[] {
  const anomalies: OnboardingAnomaly[] = [];

  // ── Rule 1: Revenue / order-volume contradiction ─────────────────────────
  if (
    onboarding.annualRevenueBand === "200m_plus" &&
    onboarding.monthlyOrderVolumeBand === "under_100"
  ) {
    anomalies.push({
      anomalyType: "revenue_volume_contradiction",
      reason:
        "Annual revenue exceeds R200M but monthly order volume is under 100 — scale signals are contradictory and likely reflect a data entry error.",
      severity: "high",
    });
  } else if (
    onboarding.annualRevenueBand === "under_1m" &&
    onboarding.monthlyOrderVolumeBand === "10000_plus"
  ) {
    anomalies.push({
      anomalyType: "revenue_volume_contradiction",
      reason:
        "Monthly order volume exceeds 10,000 but annual revenue is under R1M — revenue is implausibly low for this order rate.",
      severity: "medium",
    });
  }

  // ── Rule 2: Employee headcount / revenue mismatch ────────────────────────
  if (
    onboarding.employees === "50+" &&
    onboarding.annualRevenueBand === "under_1m"
  ) {
    anomalies.push({
      anomalyType: "employee_revenue_mismatch",
      reason:
        "50+ employees declared but annual revenue is under R1M — revenue appears very low for an organisation of this size.",
      severity: "medium",
    });
  }

  // ── Rule 3: Inventory / fulfillment model contradiction ──────────────────
  if (
    onboarding.inventoryModel === "none" &&
    onboarding.fulfillmentModel === "in_house"
  ) {
    anomalies.push({
      anomalyType: "inventory_fulfillment_contradiction",
      reason:
        "Inventory model is 'none' but fulfillment is declared as in-house — an organisation cannot fulfil orders in-house without holding inventory.",
      severity: "high",
    });
  }

  // ── Rule 4: Very high volume through a single sales channel ──────────────
  if (
    onboarding.monthlyOrderVolumeBand === "10000_plus" &&
    onboarding.salesChannels.length === 1
  ) {
    anomalies.push({
      anomalyType: "high_volume_single_channel",
      reason:
        "10,000+ monthly orders reported through a single sales channel — atypical distribution for this volume tier; verify channel data.",
      severity: "medium",
    });
  }

  // ── Rule 5: Service provider with high B2C transaction volume ────────────
  if (
    onboarding.businessModel === "service_provider" &&
    onboarding.customerSegment === "b2c" &&
    ["1000_10000", "10000_plus"].includes(onboarding.monthlyOrderVolumeBand)
  ) {
    anomalies.push({
      anomalyType: "service_provider_b2c_volume",
      reason:
        "Service providers rarely transact at high B2C order volumes — verify business model classification before dispatching to providers.",
      severity: "medium",
    });
  }

  // ── Rule 6: Regulated status with minimal compliance footprint ───────────
  if (
    onboarding.regulated &&
    onboarding.annualRevenueBand === "under_1m" &&
    !onboarding.regions.includes("cross_border")
  ) {
    anomalies.push({
      anomalyType: "regulated_minimal_footprint",
      reason:
        "Regulated status is flagged but revenue and regional profile suggest a very small domestic operation — confirm whether regulatory classification is accurate.",
      severity: "low",
    });
  }

  // ── Rule 7: Enterprise / strategic package vs minimal business profile ───
  const normalizedTier = packageTier.toLowerCase();
  const isEnterpriseTier =
    normalizedTier.includes("enterprise") ||
    normalizedTier.includes("strategic");

  if (
    isEnterpriseTier &&
    onboarding.annualRevenueBand === "under_1m" &&
    onboarding.employees === "1-20"
  ) {
    anomalies.push({
      anomalyType: "enterprise_tier_profile_mismatch",
      reason:
        "Enterprise or strategic package selected but revenue and headcount suggest a micro-business — manual tier verification is recommended.",
      severity: "medium",
    });
  }

  // ── Rule 8: Low intelligence confidence score ────────────────────────────
  if (confidenceScore < 55) {
    anomalies.push({
      anomalyType: "low_confidence_profile",
      reason: `Onboarding intelligence confidence score is ${confidenceScore}/100 — key profile fields may be incomplete or internally inconsistent.`,
      severity: "low",
    });
  }

  return anomalies;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

interface PersistOnboardingAnomaliesInput {
  supabase: SupabaseClient;
  organizationId: string;
  onboardingSubmissionId: string;
  profileId: string;
  anomalies: OnboardingAnomaly[];
}

/**
 * Writes detected anomalies to `onboarding_anomaly_alerts`.
 * Non-fatal: a persistence failure is logged but never re-thrown so that
 * the parent account-creation flow is not blocked.
 */
export async function persistOnboardingAnomalies(
  input: PersistOnboardingAnomaliesInput,
): Promise<void> {
  if (input.anomalies.length === 0) {
    return;
  }

  const rows = input.anomalies.map((anomaly) => ({
    organization_id: input.organizationId,
    onboarding_submission_id: input.onboardingSubmissionId,
    profile_id: input.profileId,
    anomaly_type: anomaly.anomalyType,
    reason: anomaly.reason,
    severity: anomaly.severity,
    status: "pending_review",
  }));

  const { error } = await input.supabase
    .from("onboarding_anomaly_alerts")
    .insert(rows);

  if (error) {
    // Anomaly tracking must never break account creation.
    console.error(
      "[onboarding-anomaly] Failed to persist anomalies:",
      error.message,
    );
  }
}

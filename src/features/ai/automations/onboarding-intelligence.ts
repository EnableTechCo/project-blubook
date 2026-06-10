import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateRoutingRecommendations,
  persistRoutingRecommendations,
} from "./provider-routing";
import {
  detectOnboardingAnomalies,
  persistOnboardingAnomalies,
} from "./onboarding-anomaly";

export interface OnboardingAutomationSignals {
  primaryIndustry: string;
  subIndustry?: string | null;
  businessModel:
    | "seller"
    | "reseller"
    | "distributor"
    | "manufacturer"
    | "marketplace"
    | "service_provider";
  customerSegment: "b2b" | "b2c" | "hybrid";
  salesChannels: Array<
    | "own_website"
    | "marketplace"
    | "retail"
    | "wholesale"
    | "social"
    | "direct_sales"
  >;
  inventoryModel: "own_stock" | "dropship" | "hybrid" | "none";
  fulfillmentModel: "in_house" | "third_party" | "hybrid";
  annualRevenueBand:
    | "under_1m"
    | "1m_10m"
    | "10m_50m"
    | "50m_200m"
    | "200m_plus";
  monthlyOrderVolumeBand:
    | "under_100"
    | "100_1000"
    | "1000_10000"
    | "10000_plus";
  companyType: "llc" | "corporation" | "partnership";
  employees: "1-20" | "21-49" | "50+";
  inventoryHandling: "in_house" | "third_party" | "none";
  regulated: boolean;
  regions: Array<"domestic" | "cross_border">;
}

interface PersistCustomerOnboardingAutomationInput {
  supabase: SupabaseClient;
  organizationId: string;
  onboardingSubmissionId: string;
  packageTier: string;
  country: string;
  city: string;
  onboarding: OnboardingAutomationSignals;
  createdBy: string | null;
}

export interface PersistedOnboardingAutomationResult {
  profileId: string;
  priorityScore: number;
  priorityTier: "standard" | "high" | "critical" | "strategic";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function tierSignal(packageTier: string): number {
  const normalized = packageTier.toLowerCase();
  if (normalized.includes("enterprise") || normalized.includes("strategic")) {
    return 10;
  }
  if (normalized.includes("pro") || normalized.includes("premium")) {
    return 6;
  }
  if (normalized.includes("growth") || normalized.includes("plus")) {
    return 3;
  }
  return 0;
}

function computePriorityScore(
  onboarding: OnboardingAutomationSignals,
  packageTier: string,
): number {
  let score = 38;

  if (onboarding.regulated) {
    score += 16;
  }
  if (onboarding.regions.includes("cross_border")) {
    score += 12;
  }
  if (["reseller", "distributor"].includes(onboarding.businessModel)) {
    score += 8;
  }
  if (["marketplace", "manufacturer"].includes(onboarding.businessModel)) {
    score += 6;
  }
  if (
    onboarding.salesChannels.includes("marketplace") ||
    onboarding.salesChannels.includes("social")
  ) {
    score += 8;
  }
  if (onboarding.customerSegment === "hybrid") {
    score += 5;
  }
  if (
    ["10m_50m", "50m_200m", "200m_plus"].includes(onboarding.annualRevenueBand)
  ) {
    score += 6;
  }
  if (
    ["1000_10000", "10000_plus"].includes(onboarding.monthlyOrderVolumeBand)
  ) {
    score += 7;
  }
  if (onboarding.salesChannels.length >= 3) {
    score += 4;
  }
  score += tierSignal(packageTier);

  return clamp(score, 0, 100);
}

function computeConfidenceScore(
  onboarding: OnboardingAutomationSignals,
): number {
  let confidence = 62;

  if (onboarding.subIndustry && onboarding.subIndustry.trim().length >= 2) {
    confidence += 5;
  }
  if (onboarding.salesChannels.length >= 2) {
    confidence += 5;
  }
  if (onboarding.regions.length >= 1) {
    confidence += 4;
  }
  if (onboarding.annualRevenueBand !== "under_1m") {
    confidence += 4;
  }
  if (onboarding.monthlyOrderVolumeBand !== "under_100") {
    confidence += 4;
  }
  if (onboarding.customerSegment === "hybrid") {
    confidence += 3;
  }
  if (onboarding.inventoryModel === "hybrid") {
    confidence -= 2;
  }

  return clamp(confidence, 45, 95);
}

function priorityTierFromScore(
  score: number,
): "standard" | "high" | "critical" | "strategic" {
  if (score >= 85) {
    return "strategic";
  }
  if (score >= 70) {
    return "critical";
  }
  if (score >= 55) {
    return "high";
  }
  return "standard";
}

export async function persistCustomerOnboardingAutomation(
  input: PersistCustomerOnboardingAutomationInput,
): Promise<PersistedOnboardingAutomationResult> {
  const {
    supabase,
    organizationId,
    onboardingSubmissionId,
    onboarding,
    packageTier,
  } = input;
  const confidenceScore = computeConfidenceScore(onboarding);

  const { data: intelligenceProfile, error: intelligenceError } = await supabase
    .from("customer_intelligence_profiles")
    .insert({
      organization_id: organizationId,
      onboarding_submission_id: onboardingSubmissionId,
      primary_industry: onboarding.primaryIndustry,
      sub_industry: onboarding.subIndustry ?? null,
      business_model: onboarding.businessModel,
      customer_segment: onboarding.customerSegment,
      sales_channels: onboarding.salesChannels,
      inventory_model: onboarding.inventoryModel,
      fulfillment_model: onboarding.fulfillmentModel,
      regulated: onboarding.regulated,
      regions: onboarding.regions,
      annual_revenue_band: onboarding.annualRevenueBand,
      monthly_order_volume_band: onboarding.monthlyOrderVolumeBand,
      feature_vector: {
        company_type: onboarding.companyType,
        employees: onboarding.employees,
        inventory_handling: onboarding.inventoryHandling,
      },
      signal_snapshot: {
        package_tier: packageTier,
        country: input.country,
        city: input.city,
      },
      confidence_score: confidenceScore,
    })
    .select("id")
    .single();

  if (intelligenceError || !intelligenceProfile) {
    throw new Error(
      intelligenceError?.message ??
        "Could not create customer intelligence profile.",
    );
  }

  const priorityScore = computePriorityScore(onboarding, packageTier);
  const priorityTier = priorityTierFromScore(priorityScore);

  const { error: priorityError } = await supabase
    .from("customer_priority_scores")
    .insert({
      organization_id: organizationId,
      profile_id: intelligenceProfile.id,
      score: priorityScore,
      tier: priorityTier,
      reason_summary:
        "Initial readiness estimate based on onboarding information.",
      score_factors: {
        package_tier: packageTier,
        regulated: onboarding.regulated,
        regions: onboarding.regions,
        business_model: onboarding.businessModel,
        sales_channels: onboarding.salesChannels,
        annual_revenue_band: onboarding.annualRevenueBand,
        monthly_order_volume_band: onboarding.monthlyOrderVolumeBand,
      },
      model_version: "onboarding-v2",
      is_active: true,
      created_by: input.createdBy,
    });

  if (priorityError) {
    throw new Error(priorityError.message);
  }

  // Generate and persist provider routing recommendations (non-fatal).
  // Loads active rules and partners from DB then writes to automation_decisions.
  void (async () => {
    try {
      const [{ data: rules }, { data: partners }] = await Promise.all([
        supabase
          .from("automation_rules")
          .select(
            "rule_key, name, stream, condition_json, action_json, priority_weight, enabled",
          )
          .eq("enabled", true),
        supabase
          .from("service_partners")
          .select("id, package_stream, name")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      const recommendations = generateRoutingRecommendations(
        onboarding,
        priorityTier,
        confidenceScore,
        partners ?? [],
        (rules ?? []) as Parameters<typeof generateRoutingRecommendations>[4],
      );

      await persistRoutingRecommendations({
        supabase,
        organizationId,
        profileId: intelligenceProfile.id,
        recommendations,
      });
    } catch (err) {
      console.error(
        "[onboarding-intelligence] provider routing step failed:",
        err instanceof Error ? err.message : err,
      );
    }
  })();

  // Anomaly detection — runs after scoring so confidence is available.
  // Non-fatal: failures are logged inside persistOnboardingAnomalies.
  const anomalies = detectOnboardingAnomalies(
    onboarding,
    packageTier,
    confidenceScore,
  );
  await persistOnboardingAnomalies({
    supabase,
    organizationId,
    onboardingSubmissionId,
    profileId: intelligenceProfile.id,
    anomalies,
  });

  return {
    profileId: intelligenceProfile.id,
    priorityScore,
    priorityTier,
  };
}

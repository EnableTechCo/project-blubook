import type { SupabaseClient } from "@supabase/supabase-js";

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

function computePriorityScore(onboarding: OnboardingAutomationSignals): number {
  let score = 40;

  if (onboarding.regulated) {
    score += 20;
  }
  if (onboarding.regions.includes("cross_border")) {
    score += 15;
  }
  if (["reseller", "distributor"].includes(onboarding.businessModel)) {
    score += 10;
  }
  if (
    onboarding.salesChannels.includes("marketplace") ||
    onboarding.salesChannels.includes("social")
  ) {
    score += 10;
  }

  return Math.min(score, 100);
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
  const { supabase, organizationId, onboardingSubmissionId, onboarding } =
    input;

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
        package_tier: input.packageTier,
        country: input.country,
        city: input.city,
      },
      confidence_score: 78,
    })
    .select("id")
    .single();

  if (intelligenceError || !intelligenceProfile) {
    throw new Error(
      intelligenceError?.message ??
        "Could not create customer intelligence profile.",
    );
  }

  const priorityScore = computePriorityScore(onboarding);
  const priorityTier = priorityTierFromScore(priorityScore);

  const { error: priorityError } = await supabase
    .from("customer_priority_scores")
    .insert({
      organization_id: organizationId,
      profile_id: intelligenceProfile.id,
      score: priorityScore,
      tier: priorityTier,
      reason_summary:
        "Initial onboarding-derived priority score based on model, channels, and compliance flags.",
      score_factors: {
        regulated: onboarding.regulated,
        regions: onboarding.regions,
        business_model: onboarding.businessModel,
        sales_channels: onboarding.salesChannels,
      },
      model_version: "onboarding-v1",
      is_active: true,
      created_by: input.createdBy,
    });

  if (priorityError) {
    throw new Error(priorityError.message);
  }

  return {
    profileId: intelligenceProfile.id,
    priorityScore,
    priorityTier,
  };
}

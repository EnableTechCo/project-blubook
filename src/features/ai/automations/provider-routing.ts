import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingAutomationSignals } from "./onboarding-intelligence";

// ─── Types mirroring DB shape ────────────────────────────────────────────────

interface AutomationRule {
  rule_key: string;
  name: string;
  stream: string | null;
  condition_json: RuleCondition;
  action_json: RuleAction;
  priority_weight: number;
  enabled: boolean;
}

interface RuleCondition {
  regulated?: boolean;
  regions_any?: string[];
  customer_segment?: string;
  sales_channels_any?: string[];
  business_model_any?: string[];
}

interface RuleAction {
  queue?: string;
  priority?: "standard" | "high" | "critical" | "strategic";
}

export interface ServicePartnerRecord {
  id: string;
  package_stream: string;
  name: string;
}

// ─── Output shape ─────────────────────────────────────────────────────────────

export interface RoutingRecommendation {
  stream: string;
  recommendedPartnerId: string | null;
  recommendedPartnerName: string;
  recommendedPriority: "standard" | "high" | "critical" | "strategic";
  confidence: number;
  reason: string;
  source: "rule" | "ai" | "hybrid";
  matchedRuleKey: string | null;
  matchedRuleName: string | null;
  recommendationJson: Record<string, unknown>;
}

// ─── Stream selection ─────────────────────────────────────────────────────────
// Determines which service streams an onboarded org requires based on
// their profile signals and priority tier.

const PRIORITY_RANK: Record<string, number> = {
  standard: 0,
  high: 1,
  critical: 2,
  strategic: 3,
};

function higherPriority(
  a: "standard" | "high" | "critical" | "strategic",
  b: "standard" | "high" | "critical" | "strategic",
): "standard" | "high" | "critical" | "strategic" {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

function resolveRequiredStreams(
  profile: OnboardingAutomationSignals,
  priorityTier: "standard" | "high" | "critical" | "strategic",
): Set<string> {
  const streams = new Set<string>();

  // Every customer needs accounting and legal.
  streams.add("Financial Accounting");
  streams.add("Legal");

  // Sales Ops: B2B / marketplace / distribution business models or channels.
  if (
    ["seller", "reseller", "distributor", "manufacturer", "marketplace"].includes(
      profile.businessModel,
    ) ||
    profile.salesChannels.some((c) =>
      ["marketplace", "wholesale", "direct_sales"].includes(c),
    )
  ) {
    streams.add("Sales Ops");
  }

  // Marketing: consumer-facing or consumer-channel signals.
  if (
    ["b2c", "hybrid"].includes(profile.customerSegment) ||
    profile.salesChannels.some((c) =>
      ["marketplace", "social", "retail"].includes(c),
    )
  ) {
    streams.add("Marketing");
  }

  // IT Hosting: own web presence or marketplace infrastructure.
  if (
    profile.salesChannels.includes("own_website") ||
    profile.businessModel === "marketplace"
  ) {
    streams.add("IT Hosting");
  }

  // Human Resources: medium or large headcount.
  if (["21-49", "50+"].includes(profile.employees)) {
    streams.add("Human Resources");
  }

  // Post Sales Support: high order volume or regulated industry.
  if (
    ["1000_10000", "10000_plus"].includes(profile.monthlyOrderVolumeBand) ||
    profile.regulated
  ) {
    streams.add("Post Sales Support");
  }

  // Mgt Consulting: strategic or critical tier, or high-revenue band.
  if (
    ["critical", "strategic"].includes(priorityTier) ||
    ["50m_200m", "200m_plus"].includes(profile.annualRevenueBand)
  ) {
    streams.add("Mgt Consulting");
  }

  // Logistics: active in-house or hybrid fulfillment with real inventory.
  if (
    ["in_house", "hybrid"].includes(profile.fulfillmentModel) &&
    profile.inventoryModel !== "none"
  ) {
    streams.add("Logistics");
  }

  return streams;
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

function evaluateRule(
  rule: AutomationRule,
  profile: OnboardingAutomationSignals,
): boolean {
  const c = rule.condition_json;

  if (c.regulated !== undefined && c.regulated !== profile.regulated) {
    return false;
  }
  if (
    c.regions_any &&
    !c.regions_any.some((r) => profile.regions.includes(r as "domestic" | "cross_border"))
  ) {
    return false;
  }
  if (c.customer_segment && c.customer_segment !== profile.customerSegment) {
    return false;
  }
  if (
    c.sales_channels_any &&
    !c.sales_channels_any.some((ch) =>
      profile.salesChannels.includes(
        ch as
          | "own_website"
          | "marketplace"
          | "retail"
          | "wholesale"
          | "social"
          | "direct_sales",
      ),
    )
  ) {
    return false;
  }
  if (
    c.business_model_any &&
    !c.business_model_any.includes(profile.businessModel)
  ) {
    return false;
  }

  return true;
}

// ─── Partner selection ────────────────────────────────────────────────────────
// Picks the best partner for a stream. Currently deterministic (first in list
// after light scoring); can be extended with workload/capacity data.

function selectPartner(
  stream: string,
  partners: ServicePartnerRecord[],
): ServicePartnerRecord | null {
  const candidates = partners.filter((p) => p.package_stream === stream);
  if (candidates.length === 0) return null;
  // Return first — list is ordered alphabetically by name from the query.
  return candidates[0];
}

function alternativePartners(
  stream: string,
  excludeId: string | null,
  partners: ServicePartnerRecord[],
): Array<{ id: string; name: string }> {
  return partners
    .filter((p) => p.package_stream === stream && p.id !== excludeId)
    .map((p) => ({ id: p.id, name: p.name }));
}

// ─── Stream-level base reasons ────────────────────────────────────────────────

function baseReason(
  stream: string,
  profile: OnboardingAutomationSignals,
  priorityTier: string,
): string {
  switch (stream) {
    case "Financial Accounting":
      return "Required for all onboarded customers";
    case "Legal":
      return profile.regulated
        ? "Regulated entity — compliance-grade legal support required"
        : "Standard legal services required for all customers";
    case "Sales Ops":
      return `Business model (${profile.businessModel}) and channels (${profile.salesChannels.join(", ")}) require sales operations support`;
    case "Marketing":
      return `${profile.customerSegment.toUpperCase()} segment with ${profile.salesChannels.join("/")} channels`;
    case "IT Hosting":
      return `Online presence detected (${profile.salesChannels.filter((c) => ["own_website", "marketplace"].includes(c)).join(", ")})`;
    case "Human Resources":
      return `Team size ${profile.employees} employees warrants HR support`;
    case "Post Sales Support":
      return profile.regulated
        ? "Regulated industry requires post-sales compliance support"
        : `High order volume (${profile.monthlyOrderVolumeBand.replace("_", "–")}) requires post-sales support`;
    case "Mgt Consulting":
      return `${priorityTier.toUpperCase()} priority customer — strategic consulting recommended`;
    case "Logistics":
      return `${profile.fulfillmentModel} fulfillment model requires logistics coordination`;
    default:
      return `${stream} stream required`;
  }
}

// ─── Core public function ─────────────────────────────────────────────────────

export function generateRoutingRecommendations(
  profile: OnboardingAutomationSignals,
  priorityTier: "standard" | "high" | "critical" | "strategic",
  baseConfidence: number,
  partners: ServicePartnerRecord[],
  rules: AutomationRule[],
): RoutingRecommendation[] {
  const requiredStreams = resolveRequiredStreams(profile, priorityTier);
  const enabledRules = rules
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority_weight - a.priority_weight);

  const recommendations: RoutingRecommendation[] = [];

  for (const stream of requiredStreams) {
    // Find highest-priority rule that applies to this stream.
    const matchedRule = enabledRules.find(
      (rule) =>
        (!rule.stream || rule.stream === stream) &&
        evaluateRule(rule, profile),
    ) ?? null;

    const partner = selectPartner(stream, partners);
    const alternatives = alternativePartners(stream, partner?.id ?? null, partners);

    let priority = priorityTier;
    let confidence = baseConfidence;
    const reasonParts: string[] = [baseReason(stream, profile, priorityTier)];

    let source: "rule" | "ai" | "hybrid" = "ai";

    if (matchedRule) {
      const ruleAction = matchedRule.action_json as RuleAction;
      if (ruleAction.priority) {
        priority = higherPriority(priority, ruleAction.priority);
      }
      confidence = Math.min(95, confidence + 8);
      reasonParts.push(`Rule "${matchedRule.name}" matched`);
      source = priorityTier !== "standard" ? "hybrid" : "rule";
    }

    // Cross-border complexity slightly lowers confidence.
    if (profile.regions.includes("cross_border")) {
      confidence = Math.max(45, confidence - 4);
    }

    recommendations.push({
      stream,
      recommendedPartnerId: partner?.id ?? null,
      recommendedPartnerName: partner?.name ?? "Unassigned",
      recommendedPriority: priority,
      confidence: Math.round(confidence),
      reason: reasonParts.join(". "),
      source,
      matchedRuleKey: matchedRule?.rule_key ?? null,
      matchedRuleName: matchedRule?.name ?? null,
      recommendationJson: {
        stream,
        partner_id: partner?.id ?? null,
        partner_name: partner?.name ?? null,
        priority,
        confidence: Math.round(confidence),
        matched_rule: matchedRule?.rule_key ?? null,
        alternative_partners: alternatives,
        signals_used: [
          profile.businessModel,
          profile.customerSegment,
          ...profile.salesChannels,
          ...profile.regions,
          ...(profile.regulated ? ["regulated"] : []),
        ],
      },
    });
  }

  // Sort: most urgent first, then highest confidence.
  recommendations.sort((a, b) => {
    const pd = PRIORITY_RANK[b.recommendedPriority] - PRIORITY_RANK[a.recommendedPriority];
    if (pd !== 0) return pd;
    return b.confidence - a.confidence;
  });

  return recommendations;
}

// ─── Persistence (non-fatal) ──────────────────────────────────────────────────

export interface PersistRoutingRecommendationsInput {
  supabase: SupabaseClient;
  organizationId: string;
  profileId: string;
  recommendations: RoutingRecommendation[];
}

export async function persistRoutingRecommendations(
  input: PersistRoutingRecommendationsInput,
): Promise<void> {
  if (input.recommendations.length === 0) return;

  try {
    const rows = input.recommendations.map((rec) => ({
      organization_id: input.organizationId,
      profile_id: input.profileId,
      source: rec.source,
      recommended_priority: rec.recommendedPriority,
      recommended_stream: rec.stream,
      // recommended_owner_id references auth.users, not service_partners.
      // Partner assignment is stored in recommendation_json instead.
      recommended_owner_id: null,
      recommendation_json: rec.recommendationJson,
      explanation: rec.reason,
      confidence_score: rec.confidence,
      status: "pending",
    }));

    const { error } = await input.supabase
      .from("automation_decisions")
      .insert(rows);

    if (error) {
      console.error(
        "[provider-routing] Failed to persist routing recommendations:",
        error.message,
      );
    }
  } catch (err) {
    console.error(
      "[provider-routing] Unexpected error persisting routing recommendations:",
      err instanceof Error ? err.message : err,
    );
  }
}

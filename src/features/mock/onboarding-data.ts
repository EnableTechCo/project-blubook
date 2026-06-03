export type OnboardingBusinessModel =
  | "manufacturer"
  | "reseller"
  | "distributor"
  | "service_provider";

export type OnboardingIndustry =
  | "retail"
  | "beauty"
  | "food"
  | "industrial"
  | "saas"
  | "other";

export type OnboardingOrderComplexity = "low" | "medium" | "high";

export type OnboardingInventoryHandling = "in_house" | "third_party" | "none";

export interface MockOnboardingProfile {
  business_model: OnboardingBusinessModel;
  industry: OnboardingIndustry;
  order_complexity: OnboardingOrderComplexity;
  inventory_handling: OnboardingInventoryHandling;
  regions_served: Array<"domestic" | "cross_border">;
  regulated: boolean;
  workforce_size: number;
  systems: Array<"erp" | "crm" | "accounting" | "fulfillment" | "none">;
}

export interface MockPackageCatalogItem {
  id: string;
  label: string;
  teams: string[];
  summary: string;
  sla: string;
}

export const MOCK_PACKAGE_CATALOG: MockPackageCatalogItem[] = [
  {
    id: "finance_core",
    label: "Finance Core",
    teams: ["finance"],
    summary: "Monthly bookkeeping, close, reconciliation and reporting.",
    sla: "Monthly close by business day 5",
  },
  {
    id: "sales_ops_engine",
    label: "Sales Ops Engine",
    teams: ["sales_ops", "finance"],
    summary: "Order intake, validation, handoff and order-to-cash operations.",
    sla: "First response under 4 hours",
  },
  {
    id: "marketing_growth",
    label: "Marketing Growth",
    teams: ["marketing"],
    summary: "Campaign operations, content calendar and reporting.",
    sla: "Launch in 5 business days",
  },
  {
    id: "legal_compliance",
    label: "Legal and Compliance",
    teams: ["legal"],
    summary: "Contract review, filing calendar and compliance guardrails.",
    sla: "Review turnaround under 3 business days",
  },
  {
    id: "hr_operations",
    label: "HR Operations",
    teams: ["hr", "legal"],
    summary: "Payroll support, employee onboarding and policy workflows.",
    sla: "Payroll cycle on time",
  },
  {
    id: "logistics_control",
    label: "Logistics Control",
    teams: ["logistics", "sales_ops"],
    summary: "Storage, dispatch milestones and proof-of-delivery workflows.",
    sla: "Dispatch within agreed cut-off",
  },
];

export const MOCK_ONBOARDING_PRESETS: Array<{
  id: string;
  label: string;
  profile: MockOnboardingProfile;
}> = [
  {
    id: "hats_distributor",
    label: "Hats distributor",
    profile: {
      business_model: "distributor",
      industry: "retail",
      order_complexity: "high",
      inventory_handling: "third_party",
      regions_served: ["domestic"],
      regulated: false,
      workforce_size: 26,
      systems: ["crm", "accounting"],
    },
  },
  {
    id: "skincare_brand",
    label: "Skincare brand",
    profile: {
      business_model: "manufacturer",
      industry: "beauty",
      order_complexity: "medium",
      inventory_handling: "in_house",
      regions_served: ["domestic", "cross_border"],
      regulated: true,
      workforce_size: 18,
      systems: ["erp", "crm", "accounting"],
    },
  },
  {
    id: "industrial_parts",
    label: "Industrial parts distributor",
    profile: {
      business_model: "distributor",
      industry: "industrial",
      order_complexity: "high",
      inventory_handling: "third_party",
      regions_served: ["domestic", "cross_border"],
      regulated: true,
      workforce_size: 64,
      systems: ["erp", "crm", "accounting", "fulfillment"],
    },
  },
];

export function deriveOnboardingRecommendation(profile: MockOnboardingProfile) {
  const packageIds = new Set<string>();

  if (["medium", "high"].includes(profile.order_complexity)) {
    packageIds.add("sales_ops_engine");
  }

  if (["in_house", "third_party"].includes(profile.inventory_handling)) {
    packageIds.add("logistics_control");
  }

  if (!profile.systems.includes("accounting")) {
    packageIds.add("finance_core");
  }

  if (profile.workforce_size >= 20) {
    packageIds.add("hr_operations");
  }

  if (profile.regulated || profile.regions_served.includes("cross_border")) {
    packageIds.add("legal_compliance");
  }

  if (profile.industry === "beauty") {
    packageIds.add("marketing_growth");
  }

  const selectedPackages = MOCK_PACKAGE_CATALOG.filter((item) =>
    packageIds.has(item.id),
  );

  const activatedTeams = Array.from(
    new Set(selectedPackages.flatMap((item) => item.teams)),
  );

  const alerts = [
    "SLA breach risk when 70% of window is consumed with no owner action.",
    "Stuck workflow alert after 24h (high priority) or 72h (normal priority).",
    "Missing document escalation after 2 reminders or 48h overdue.",
  ];

  return {
    packageIds: Array.from(packageIds),
    selectedPackages,
    activatedTeams,
    alerts,
  };
}

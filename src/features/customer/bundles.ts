export interface ServiceBundle {
  id: string;
  category: string;
  image: string;
  title: string;
  description: string;
  features: string[];
  price: string;
  billing: string;
  tone: "slate" | "teal" | "amber" | "indigo";
}

export const CUSTOMER_SERVICE_BUNDLES: ServiceBundle[] = [
  {
    id: "hvac-maintenance",
    category: "Maintenance",
    image: "/images/storefront/bundle-hvac.svg",
    title: "Home Maintenance and HVAC",
    description:
      "Complete preventive upkeep including HVAC optimization and appliance performance checks.",
    features: ["Annual system optimization", "Same-day emergency service"],
    price: "R1,450",
    billing: "residence / year",
    tone: "slate",
  },
  {
    id: "plumbing-repair",
    category: "Essentials",
    image: "/images/storefront/bundle-plumbing.svg",
    title: "Plumbing Maintenance and Repair",
    description:
      "Inspection, leak diagnostics and precision fixture servicing for stable daily operations.",
    features: ["Smart leak detection setup", "Fixture and pipe upgrades"],
    price: "R800",
    billing: "service call",
    tone: "teal",
  },
  {
    id: "electrical-safety",
    category: "Safety",
    image: "/images/storefront/bundle-electrical.svg",
    title: "Electrical Safety Bundle",
    description:
      "Certified diagnostics, grounding verification and panel reviews for safer installations.",
    features: ["Whole-home surge protection", "Panel inspection and labeling"],
    price: "R1,200",
    billing: "audit / year",
    tone: "amber",
  },
  {
    id: "smart-security",
    category: "Security",
    image: "/images/storefront/bundle-security.svg",
    title: "Smart Security and Monitoring",
    description:
      "Integrated monitoring with encrypted controls, alerts and professional dispatch workflows.",
    features: ["App-integrated alerts", "Professional dispatch link"],
    price: "R1,050",
    billing: "residence / month",
    tone: "indigo",
  },
];

export function getBundleById(bundleId: string | null) {
  if (!bundleId) {
    return null;
  }

  return (
    CUSTOMER_SERVICE_BUNDLES.find((bundle) => bundle.id === bundleId) ?? null
  );
}

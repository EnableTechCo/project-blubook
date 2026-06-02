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
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
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
    image:
      "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1600&q=80",
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
    image:
      "https://images.unsplash.com/photo-1558442086-8ea19f8f7f91?auto=format&fit=crop&w=1600&q=80",
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
    image:
      "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1600&q=80",
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

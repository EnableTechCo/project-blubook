import { createClient } from "@supabase/supabase-js";
import { HomePageClient, type LandingPackage } from "./home-page-client";

const PACKAGE_IMAGES = [
  "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=2000&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
] as const;

function mapPackages(
  data: Array<{
    code: string;
    name: string;
    description: string | null;
    unit_amount_cents: number;
    metadata: unknown;
  }>,
): LandingPackage[] {
  return data.map((item, index) => {
    const metadata =
      typeof item.metadata === "object" && item.metadata !== null
        ? (item.metadata as {
            display_price?: string;
            highlights?: string[];
            badge?: string;
          })
        : {};
    const streamHighlights = Array.isArray(metadata.highlights)
      ? metadata.highlights
      : [];

    return {
      id: item.code,
      tier: item.name,
      badge: metadata.badge ?? "Operational Package",
      price:
        metadata.display_price ??
        `R${new Intl.NumberFormat("en-ZA").format(item.unit_amount_cents / 100)}/mo`,
      image: PACKAGE_IMAGES[index % PACKAGE_IMAGES.length],
      summary:
        item.description ??
        "Configurable package with scalable service coverage.",
      highlights:
        streamHighlights.length > 0
          ? streamHighlights.slice(0, 3)
          : [
              "Configurable stream scope",
              "Managed delivery",
              "Scalable support",
            ],
      sla: "Support window aligned to selected package",
      responseWindow: "Managed response by subscribed service streams",
      first14Days: [
        `Operating plan setup for ${item.name}`,
        "Service stream activation and partner alignment",
        "Onboarding checklist and launch workflow completed",
      ],
    };
  });
}

export default async function HomePage() {
  let data: Array<{
    code: string;
    name: string;
    description: string | null;
    unit_amount_cents: number;
    metadata: unknown;
  }> | null = null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    try {
      const result = await supabase
        .from("service_packages")
        .select("code, name, description, unit_amount_cents, metadata")
        .eq("is_active", true)
        .order("unit_amount_cents", { ascending: true });

      data = result.data;
    } catch {
      data = [];
    }
  } else {
    data = [];
  }

  const packages = mapPackages(data ?? []);

  return <HomePageClient packages={packages} />;
}

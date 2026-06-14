import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";

type ApiRole =
  | "customer"
  | "partner"
  | "staff"
  | "admin"
  | "sales"
  | "logistics";

type HandoffStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "rejected";

function normalizeRole(value: unknown): ApiRole | null {
  if (typeof value !== "string") return null;
  const n = value.trim().toLowerCase();
  if (
    n === "customer" ||
    n === "partner" ||
    n === "staff" ||
    n === "admin" ||
    n === "sales" ||
    n === "logistics"
  ) {
    return n;
  }
  return null;
}

function readPartnerEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata as {
    contact_email?: unknown;
    partner_email?: unknown;
    email?: unknown;
  };

  const candidate =
    (typeof value.contact_email === "string" ? value.contact_email : null) ??
    (typeof value.partner_email === "string" ? value.partner_email : null) ??
    (typeof value.email === "string" ? value.email : null);

  return candidate && candidate.length > 0 ? candidate : null;
}

function readPreferredSalesPartnerEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const candidate = (metadata as { preferred_sales_partner_email?: unknown })
    .preferred_sales_partner_email;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildProviderScore(input: {
  active: number;
  completed: number;
  rejected: number;
}) {
  const raw =
    72 + input.completed * 2 - input.active * 1.5 - input.rejected * 8;
  return clamp(Math.round(raw), 0, 99);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, organization_id, metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  const role =
    normalizeRole(profile?.role) ??
    normalizeRole((user.user_metadata as { role?: unknown } | null)?.role) ??
    normalizeRole((user.app_metadata as { role?: unknown } | null)?.role);

  if (!role || !["admin", "staff", "sales", "partner"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: order, error: orderError } = await admin
    .from("sales_orders")
    .select("id, organization_id, metadata")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const sameOrg =
    typeof profile?.organization_id === "string" &&
    profile.organization_id === order.organization_id;

  if (role === "partner") {
    const servicePartnerId = await resolveServicePartnerIdForPartnerUser({
      admin,
      userId: user.id,
      profileMetadata: profile?.metadata ?? null,
      profileOrganizationId: profile?.organization_id ?? null,
      userMetadata: user.user_metadata,
    });

    const { data: servicePartner } = servicePartnerId
      ? await admin
          .from("service_partners")
          .select("id, metadata")
          .eq("id", servicePartnerId)
          .maybeSingle()
      : { data: null };

    const servicePartnerEmail = readPartnerEmail(servicePartner?.metadata);
    const preferredSalesPartnerEmail = readPreferredSalesPartnerEmail(
      order.metadata,
    );

    const hasDirectOrderAssignment =
      Boolean(servicePartnerEmail) &&
      Boolean(preferredSalesPartnerEmail) &&
      servicePartnerEmail?.toLowerCase() ===
        preferredSalesPartnerEmail?.toLowerCase();

    if (!sameOrg && !hasDirectOrderAssignment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!sameOrg && role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: providers, error: providersError } = await admin
    .from("service_partners")
    .select("id, name, site, package_stream, is_active")
    .eq("is_active", true)
    .ilike("package_stream", "%logistics%")
    .order("name", { ascending: true });

  if (providersError) {
    return NextResponse.json(
      { error: providersError.message },
      { status: 400 },
    );
  }

  const providerIds = (providers ?? []).map((row) => row.id);

  const { data: handoffs } = providerIds.length
    ? await admin
        .from("provider_workflow_handoffs")
        .select("to_provider_id, status")
        .in("to_provider_id", providerIds)
    : { data: [] };

  const statsByProvider = new Map<
    string,
    { active: number; completed: number; rejected: number }
  >();

  for (const row of handoffs ?? []) {
    const providerId = row.to_provider_id as string;
    const status = row.status as HandoffStatus;
    const current = statsByProvider.get(providerId) ?? {
      active: 0,
      completed: 0,
      rejected: 0,
    };

    if (["pending", "accepted", "in_progress"].includes(status)) {
      current.active += 1;
    } else if (status === "completed") {
      current.completed += 1;
    } else if (status === "rejected") {
      current.rejected += 1;
    }

    statsByProvider.set(providerId, current);
  }

  const logisticsProviders = (providers ?? [])
    .map((provider) => {
      const stats = statsByProvider.get(provider.id) ?? {
        active: 0,
        completed: 0,
        rejected: 0,
      };

      return {
        id: provider.id,
        name: provider.name,
        site: provider.site,
        packageStream: provider.package_stream,
        score: buildProviderScore(stats),
        stats,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const rankedProviders = logisticsProviders
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((provider, index) => ({
      ...provider,
      rank: index + 1,
    }));

  return NextResponse.json({ logisticsProviders: rankedProviders });
}

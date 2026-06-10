import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdminOrStaff() {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin, userId: user.id };
}

type DecisionRow = {
  id: string;
  organization_id: string;
  profile_id: string | null;
  source: string;
  recommended_priority: string | null;
  recommended_stream: string | null;
  recommended_owner_id: string | null;
  recommendation_json: Record<string, unknown>;
  explanation: string | null;
  confidence_score: number | null;
  status: string;
  decided_at: string;
  created_at: string;
  // FK join — Supabase returns as array
  organizations: { name: string }[] | null;
};

export async function GET(request: Request) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending";
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

    const { data, error } = await admin
      .from("automation_decisions")
      .select(
        `
        id,
        organization_id,
        profile_id,
        source,
        recommended_priority,
        recommended_stream,
        recommended_owner_id,
        recommendation_json,
        explanation,
        confidence_score,
        status,
        decided_at,
        created_at,
        organizations ( name )
      `,
      )
      .eq("status", status)
      .order("recommended_priority", { ascending: false })
      .order("confidence_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count: pendingCount } = await admin
      .from("automation_decisions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    // Partner info is stored in recommendation_json.partner_id / partner_name.
    // (recommended_owner_id is a FK to auth.users — not used for partner routing.)
    const rows = (data as unknown as DecisionRow[]) ?? [];

    // Fetch all active partners per stream for override dropdowns.
    const { data: allPartners } = await admin
      .from("service_partners")
      .select("id, package_stream, name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    const recommendations = rows.map((row) => {
      const org = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;

      const recJson = row.recommendation_json ?? {};
      const alternatives = Array.isArray(recJson.alternative_partners)
        ? (recJson.alternative_partners as Array<{ id: string; name: string }>)
        : [];

      return {
        id: row.id,
        organizationId: row.organization_id,
        profileId: row.profile_id,
        organizationName: org?.name ?? "—",
        stream: row.recommended_stream ?? "—",
        recommendedPartnerId: (recJson.partner_id as string | null) ?? null,
        recommendedPartnerName:
          (recJson.partner_name as string | null) ?? "Unassigned",
        priority: row.recommended_priority ?? "standard",
        confidence: row.confidence_score ?? 0,
        source: row.source,
        explanation: row.explanation ?? "",
        status: row.status,
        createdAt: row.created_at,
        alternativePartners: alternatives,
      };
    });

    return NextResponse.json({
      recommendations,
      pendingCount: pendingCount ?? 0,
      partnersByStream: Object.groupBy(
        (allPartners ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          stream: p.package_stream,
        })),
        (p) => p.stream,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load routing recommendations.",
      },
      { status: 500 },
    );
  }
}

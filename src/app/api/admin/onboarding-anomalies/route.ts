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

export async function GET(request: Request) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const { admin } = auth;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending_review";

    const { data, error } = await admin
      .from("onboarding_anomaly_alerts")
      .select(
        `
        id,
        organization_id,
        onboarding_submission_id,
        profile_id,
        anomaly_type,
        reason,
        severity,
        status,
        created_at,
        organizations ( name ),
        customer_onboarding_submissions ( business_title, primary_industry, business_model, country )
      `,
      )
      .eq("status", status)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count: pendingCount } = await admin
      .from("onboarding_anomaly_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review");

    type RawRow = {
      id: string;
      organization_id: string;
      onboarding_submission_id: string;
      profile_id: string;
      anomaly_type: string;
      reason: string;
      severity: string;
      status: string;
      created_at: string;
      // Supabase returns one-to-one FK joins as arrays
      organizations: { name: string }[] | null;
      customer_onboarding_submissions:
        | {
            business_title: string;
            primary_industry: string | null;
            business_model: string | null;
            country: string | null;
          }[]
        | null;
    };

    const anomalies = (data as unknown as RawRow[]).map((row) => {
      const org = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      const sub = Array.isArray(row.customer_onboarding_submissions)
        ? row.customer_onboarding_submissions[0]
        : row.customer_onboarding_submissions;

      return {
        id: row.id,
        organizationId: row.organization_id,
        submissionId: row.onboarding_submission_id,
        profileId: row.profile_id,
        anomalyType: row.anomaly_type,
        reason: row.reason,
        severity: row.severity as "low" | "medium" | "high",
        status: row.status,
        createdAt: row.created_at,
        organizationName: org?.name ?? "—",
        businessTitle: sub?.business_title ?? "—",
        primaryIndustry: sub?.primary_industry ?? null,
        businessModel: sub?.business_model ?? null,
        country: sub?.country ?? null,
      };
    });

    return NextResponse.json({
      anomalies,
      pendingCount: pendingCount ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load onboarding anomaly alerts.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  detectOrderAnomalies,
  detectInventoryAnomalies,
  detectOnboardingDuplicates,
  persistAnomalies,
} from "@/features/ai/anomaly-detection";

async function requireAdminOrStaff() {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, userId: user.id };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const { searchParams } = new URL(request.url);
    const area = searchParams.get("area");
    const since = searchParams.get("since");
    const status = searchParams.get("status") ?? "pending_review";
    const includeExamples = searchParams.get("include_examples") === "true";

    // Run live detection and persist any new anomalies (idempotent — duplicates
    // are acceptable for a review queue; ops teams dismiss noise).
    try {
      const [orderAnomalies, inventoryAnomalies, onboardingAnomalies] =
        await Promise.all([
          detectOrderAnomalies(admin),
          detectInventoryAnomalies(admin),
          detectOnboardingDuplicates(admin),
        ]);

      await persistAnomalies(admin, [
        ...orderAnomalies,
        ...inventoryAnomalies,
        ...onboardingAnomalies,
      ]);
    } catch (detectionError) {
      // Detection failures must not block the read path.
      console.error("[anomalies] Detection run failed:", detectionError);
    }

    let query = admin
      .from("anomaly_alerts")
      .select(
        "id, area, anomaly_type, severity, reason, source_entity_type, source_entity_id, source_label, is_example, status, created_at",
      )
      .eq("status", status)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (area && area !== "all") {
      query = query.eq("area", area);
    }

    if (since) {
      query = query.gte("created_at", since);
    }

    if (!includeExamples) {
      query = query.eq("is_example", false);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count: pendingCount } = await admin
      .from("anomaly_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .eq("is_example", false);

    return NextResponse.json({
      anomalies: data ?? [],
      pendingCount: pendingCount ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load anomaly alerts.",
      },
      { status: 500 },
    );
  }
}

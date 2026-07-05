import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectSlaRisks } from "@/features/ai/sla-risk";

async function requireStaffOrAdmin() {
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

  return { admin };
}

export async function GET() {
  try {
    const auth = await requireStaffOrAdmin();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const risks = await detectSlaRisks(admin);

    const counts = risks.reduce(
      (acc, item) => {
        acc[item.riskLevel]++;
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );

    return NextResponse.json({ risks, counts });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not compute SLA breach risk.",
      },
      { status: 500 },
    );
  }
}

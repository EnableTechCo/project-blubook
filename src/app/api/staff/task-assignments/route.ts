import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectTaskAssignmentRecommendations } from "@/features/ai/task-assignment";

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
    const recommendations = await detectTaskAssignmentRecommendations(admin);

    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not compute task assignment recommendations.",
      },
      { status: 500 },
    );
  }
}

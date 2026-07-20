import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requirePartnerUser() {
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

  if (!profile || profile.role !== "partner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, userId: user.id };
}

// Requests the calling partner has already claimed (partner_id = their own
// user id). Active ones (submitted/in_progress) are the ones needing an
// action; completed/rejected are kept in the response for reference.
export async function GET() {
  try {
    const auth = await requirePartnerUser();
    if ("error" in auth) return auth.error;

    const { admin, userId } = auth;

    const { data, error } = await admin
      .from("service_requests")
      .select("id, title, description, priority, status, created_at, updated_at")
      .eq("partner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load your service requests.",
      },
      { status: 500 },
    );
  }
}

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

// Unclaimed service requests, visible to any partner as a shared queue.
// service_requests.partner_id references auth.users(id) directly — a
// request is owned by the individual partner user who claimed it, not by
// their service_partner organization. There is also no service-category
// signal captured at request creation to route by, so this intentionally
// does not filter by stream — any partner can see and claim any open request.
export async function GET() {
  try {
    const auth = await requirePartnerUser();
    if ("error" in auth) return auth.error;

    const { admin } = auth;

    const { data, error } = await admin
      .from("service_requests")
      .select("id, title, description, priority, status, created_at")
      .eq("status", "submitted")
      .is("partner_id", null)
      .order("created_at", { ascending: true })
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
            : "Could not load open service requests.",
      },
      { status: 500 },
    );
  }
}

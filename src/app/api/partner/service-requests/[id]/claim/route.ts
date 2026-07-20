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

// Atomically claims an open service request for the calling partner user.
// service_requests.partner_id references auth.users(id) directly. The
// .is("partner_id", null) guard makes this race-safe — if two partners
// claim the same request at once, only the first update matches a row.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePartnerUser();
    if ("error" in auth) return auth.error;

    const { admin, userId } = auth;
    const { id } = await params;

    const { data, error } = await admin
      .from("service_requests")
      .update({
        partner_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "submitted")
      .is("partner_id", null)
      .select("id, title, status, partner_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "This request has already been claimed by another partner." },
        { status: 409 },
      );
    }

    return NextResponse.json({ id: data.id, partnerId: data.partner_id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not claim request.",
      },
      { status: 500 },
    );
  }
}

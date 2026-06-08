import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
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
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  let organizationId = profile?.organization_id ?? null;
  let role = profile?.role ?? null;
  let organizationName: string | null = null;

  if (!organizationId) {
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    organizationId = membership?.organization_id ?? null;
    role = role ?? membership?.role ?? null;
  }

  if (organizationId) {
    const { data: organization } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();

    organizationName = organization?.name ?? null;
  }

  return NextResponse.json({
    userId: user.id,
    organizationId,
    organizationName,
    role,
  });
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSupabaseClient } from "@/lib/supabase/types";

// Shared admin/staff guard for admin API routes.
//
// The same check is currently inlined in a dozen routes under /api/admin. This
// is the extracted version: new routes should use it rather than repeat the
// role lookup, because a route that merely authenticates looks protected while
// letting any signed-in user through — which is exactly how the work-order
// dispatch endpoint shipped.

export type AdminGuardResult =
  | { error: NextResponse; admin?: never; userId?: never }
  | { error?: never; admin: AppSupabaseClient; userId: string };

/** Roles permitted to act on admin API routes, matching the existing routes. */
const ADMIN_ROLES = ["admin", "staff"];

export async function requireAdminApi(): Promise<AdminGuardResult> {
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

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin, userId: user.id };
}

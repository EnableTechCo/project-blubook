import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/domain";

type RequireRouteAccessInput = {
  allowedRoles: UserRole[];
};

type RouteAccessContext = {
  userId: string;
  role: UserRole;
};

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "customer" ||
    normalized === "partner" ||
    normalized === "staff" ||
    normalized === "admin"
  ) {
    return normalized;
  }

  return null;
}

async function resolveRole(
  userId: string,
  userMetadata: unknown,
  appMetadata: unknown,
) {
  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const profileRole = normalizeRole(profile?.role);
    if (profileRole) {
      return profileRole;
    }

    const { data: membership } = await admin
      .from("organization_memberships")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const membershipRole = normalizeRole(membership?.role);
    if (membershipRole) {
      return membershipRole;
    }
  } catch {
    // Fall back to token metadata when admin lookups are unavailable.
  }

  const metadataRole =
    normalizeRole((userMetadata as { role?: unknown } | null)?.role) ??
    normalizeRole((appMetadata as { role?: unknown } | null)?.role);

  return metadataRole;
}

export async function requireRouteAccess(
  input: RequireRouteAccessInput,
): Promise<RouteAccessContext> {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await resolveRole(
    user.id,
    user.user_metadata,
    user.app_metadata,
  );

  if (!role || !input.allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }

  return {
    userId: user.id,
    role,
  };
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type UserProfileRow = {
  user_id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  membership_status: string;
  last_login_at: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  kind: string;
};

async function requireAdmin() {
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

  if (!profile || profile.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return auth.error;
    }

    const { data: profiles, error: profilesError } = await auth.admin
      .from("user_profiles")
      .select(
        "user_id, organization_id, full_name, email, role, membership_status, last_login_at, activated_at, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(500);

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message },
        { status: 400 },
      );
    }

    const profileRows = (profiles ?? []) as UserProfileRow[];

    const organizationIds = Array.from(
      new Set(
        profileRows
          .map((row) => row.organization_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let organizationRows: OrganizationRow[] = [];
    if (organizationIds.length > 0) {
      const { data: organizations, error: organizationsError } =
        await auth.admin
          .from("organizations")
          .select("id, name, kind")
          .in("id", organizationIds);

      if (organizationsError) {
        return NextResponse.json(
          { error: organizationsError.message },
          { status: 400 },
        );
      }

      organizationRows = (organizations ?? []) as OrganizationRow[];
    }

    const organizationById = new Map(
      organizationRows.map((organization) => [organization.id, organization]),
    );

    const users = profileRows.map((profile) => {
      const organization = profile.organization_id
        ? (organizationById.get(profile.organization_id) ?? null)
        : null;

      return {
        userId: profile.user_id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        membershipStatus: profile.membership_status,
        organizationId: profile.organization_id,
        organizationName: organization?.name ?? null,
        organizationKind: organization?.kind ?? null,
        lastLoginAt: profile.last_login_at,
        activatedAt: profile.activated_at,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    });

    const roleCounts = users.reduce<Record<string, number>>((acc, user) => {
      const key = user.role || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const statusCounts = users.reduce<Record<string, number>>((acc, user) => {
      const key = user.membershipStatus || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const recentlyActiveCount = users.filter(
      (user) => user.lastLoginAt !== null && user.lastLoginAt >= thirtyDaysAgo,
    ).length;

    return NextResponse.json({
      metrics: {
        total: users.length,
        byRole: roleCounts,
        byStatus: statusCounts,
        recentlyActive: recentlyActiveCount,
      },
      users,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load user roster.",
      },
      { status: 500 },
    );
  }
}

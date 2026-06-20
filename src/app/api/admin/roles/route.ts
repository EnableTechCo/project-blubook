import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MANAGEABLE_ROLES = [
  "customer",
  "partner",
  "staff",
  "admin",
  "sales",
  "logistics",
] as const;

const patchSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID."),
  role: z.enum(MANAGEABLE_ROLES),
});

type UserProfileRow = {
  user_id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  membership_status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  kind: string;
};

type AdminAuth = {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
};

async function requireAdmin(): Promise<AdminAuth | { error: NextResponse }> {
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

  return { admin, userId: user.id };
}

function buildRoleCounts(users: Array<{ role: string }>) {
  return users.reduce<Record<string, number>>((acc, user) => {
    const key = user.role || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildStatusCounts(users: Array<{ membershipStatus: string }>) {
  return users.reduce<Record<string, number>>((acc, user) => {
    const key = user.membershipStatus || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
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
        "user_id, organization_id, full_name, email, role, membership_status, last_login_at, created_at, updated_at",
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
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        membershipStatus: profile.membership_status,
        lastLoginAt: profile.last_login_at,
        organizationId: profile.organization_id,
        organizationName: organization?.name ?? null,
        organizationKind: organization?.kind ?? null,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    });

    return NextResponse.json({
      availableRoles: MANAGEABLE_ROLES,
      metrics: {
        total: users.length,
        byRole: buildRoleCounts(users),
        byStatus: buildStatusCounts(users),
      },
      users,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load admin roles data.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return auth.error;
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
        { status: 400 },
      );
    }

    const { userId, role } = parsed.data;

    if (auth.userId === userId && role !== "admin") {
      return NextResponse.json(
        {
          error:
            "You cannot remove your own admin role from this management screen.",
        },
        { status: 400 },
      );
    }

    const { data: targetProfile, error: profileError } = await auth.admin
      .from("user_profiles")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 },
      );
    }

    if (!targetProfile) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 },
      );
    }

    const previousRole = targetProfile.role;

    if (previousRole === role) {
      return NextResponse.json({
        userId,
        previousRole,
        role,
        changed: false,
      });
    }

    const { error: updateProfileError } = await auth.admin
      .from("user_profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateProfileError) {
      return NextResponse.json(
        { error: updateProfileError.message },
        { status: 400 },
      );
    }

    // Keep membership role aligned where a membership is already linked.
    const { error: membershipSyncError } = await auth.admin
      .from("organization_memberships")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    return NextResponse.json({
      userId,
      previousRole,
      role,
      changed: true,
      membershipSynced: !membershipSyncError,
      membershipSyncError: membershipSyncError?.message ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update user role.",
      },
      { status: 500 },
    );
  }
}

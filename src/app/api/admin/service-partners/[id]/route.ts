import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const partnerUpdateSchema = z.object({
  packageStream: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  site: z.string().min(3).optional(),
  isActive: z.boolean().optional(),
});

type AdminClient = ReturnType<typeof createAdminClient>;

async function requireAdminOrStaff() {
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
    .single();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

async function runCleanupStep(
  label: string,
  operation: () => PromiseLike<{ error: { message?: string } | null }>,
) {
  const { error } = await operation();
  if (error) {
    throw new Error(`${label} failed: ${error.message ?? "Unknown error"}`);
  }
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function resolvePartnerRemovalContext(admin: AdminClient, partnerId: string) {
  const { data: partner, error: partnerError } = await admin
    .from("service_partners")
    .select("id, name, metadata")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError) {
    throw new Error(`Lookup service partner failed: ${partnerError.message}`);
  }

  if (!partner) {
    throw new Error("Service partner not found.");
  }

  const { data: directProfile, error: directProfileError } = await admin
    .from("user_profiles")
    .select("user_id, organization_id, metadata")
    .eq("user_id", partnerId)
    .maybeSingle();

  if (directProfileError) {
    throw new Error(`Lookup partner profile failed: ${directProfileError.message}`);
  }

  const { data: metadataProfiles, error: metadataProfilesError } = await admin
    .from("user_profiles")
    .select("user_id, organization_id, metadata")
    .eq("metadata->>service_partner_id", partnerId);

  if (metadataProfilesError) {
    throw new Error(
      `Lookup partner metadata profiles failed: ${metadataProfilesError.message}`,
    );
  }

  const profileRows = [
    ...(directProfile ? [directProfile] : []),
    ...(metadataProfiles ?? []),
  ];
  const userIds = Array.from(
    new Set(
      profileRows
        .map((profile) => profile.user_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: directMemberships, error: directMembershipsError } = await admin
    .from("organization_memberships")
    .select("organization_id, user_id, metadata")
    .eq("user_id", partnerId);

  if (directMembershipsError) {
    throw new Error(
      `Lookup partner membership failed: ${directMembershipsError.message}`,
    );
  }

  const { data: metadataMemberships, error: metadataMembershipsError } =
    await admin
      .from("organization_memberships")
      .select("organization_id, user_id, metadata")
      .eq("metadata->>service_partner_id", partnerId);

  if (metadataMembershipsError) {
    throw new Error(
      `Lookup partner metadata memberships failed: ${metadataMembershipsError.message}`,
    );
  }

  const membershipRows = [
    ...(directMemberships ?? []),
    ...(metadataMemberships ?? []),
  ];
  const organizationIds = Array.from(
    new Set(
      [
        ...profileRows.map((profile) => profile.organization_id),
        ...membershipRows.map((membership) => membership.organization_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    partner,
    authUserIds: userIds.length > 0 ? userIds : [partnerId],
    organizationIds,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const payload = partnerUpdateSchema.parse(await request.json());

    const updatePayload: {
      package_stream?: string;
      name?: string;
      site?: string;
      is_active?: boolean;
    } = {};

    if (payload.packageStream !== undefined) {
      updatePayload.package_stream = payload.packageStream;
    }
    if (payload.name !== undefined) {
      updatePayload.name = payload.name;
    }
    if (payload.site !== undefined) {
      updatePayload.site = payload.site;
    }
    if (payload.isActive !== undefined) {
      updatePayload.is_active = payload.isActive;
    }

    const { data, error } = await auth.admin
      .from("service_partners")
      .update(updatePayload)
      .eq("id", id)
      .select("id, package_stream, name, site, is_active")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not update service partner." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      partner: {
        id: data.id,
        packageStream: data.package_stream,
        name: data.name,
        site: data.site,
        isActive: data.is_active,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update service partner.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const removalContext = await resolvePartnerRemovalContext(auth.admin, id);

    const suspendedAt = new Date().toISOString();

    await runCleanupStep("Suspend service partner record", () =>
      auth.admin.from("service_partners").update({ is_active: false }).eq("id", id),
    );

    await runCleanupStep("Dismiss partner routing decisions", () =>
      auth.admin
        .from("automation_decisions")
        .update({ status: "dismissed", decided_at: suspendedAt })
        .eq("recommended_owner_id", id),
    );

    await runCleanupStep("Dismiss partner metadata routing decisions", () =>
      auth.admin
        .from("automation_decisions")
        .update({ status: "dismissed", decided_at: suspendedAt })
        .eq("recommendation_json->>partner_id", id),
    );

    await runCleanupStep("Suspend partner memberships by metadata", () =>
      auth.admin
        .from("organization_memberships")
        .update({ status: "suspended", updated_at: suspendedAt })
        .eq("metadata->>service_partner_id", id),
    );

    for (const userId of removalContext.authUserIds) {
      await runCleanupStep(`Suspend membership for auth user ${userId}`, () =>
        auth.admin
          .from("organization_memberships")
          .update({ status: "suspended", updated_at: suspendedAt })
          .eq("user_id", userId),
      );

      await runCleanupStep(`Suspend user profile for auth user ${userId}`, () =>
        auth.admin
          .from("user_profiles")
          .update({ membership_status: "suspended", updated_at: suspendedAt })
          .eq("user_id", userId),
      );

      const { data: authUser, error: authUserError } =
        await auth.admin.auth.admin.getUserById(userId);

      if (authUserError) {
        throw new Error(
          `Lookup Supabase Auth user ${userId} failed: ${authUserError.message}`,
        );
      }

      const { error: authUpdateError } =
        await auth.admin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
          app_metadata: {
            ...toRecord(authUser.user?.app_metadata),
            status: "suspended",
            suspended_at: suspendedAt,
            service_partner_id: id,
          },
          user_metadata: {
            ...toRecord(authUser.user?.user_metadata),
            status: "suspended",
            suspended_at: suspendedAt,
            service_partner_id: id,
          },
        });

      if (authUpdateError) {
        throw new Error(
          `Suspend Supabase Auth user ${userId} failed: ${authUpdateError.message}`,
        );
      }
    }

    await runCleanupStep("Suspend partner profiles by metadata", () =>
      auth.admin
        .from("user_profiles")
        .update({ membership_status: "suspended", updated_at: suspendedAt })
        .eq("metadata->>service_partner_id", id),
    );

    for (const organizationId of removalContext.organizationIds) {
      const { count, error: countError } = await auth.admin
        .from("organization_memberships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active");

      if (countError) {
        throw new Error(
          `Check active organization memberships failed: ${countError.message}`,
        );
      }

      if ((count ?? 0) === 0) {
        await runCleanupStep(`Suspend partner organization ${organizationId}`, () =>
          auth.admin
            .from("organizations")
            .update({ status: "suspended", updated_at: suspendedAt })
            .eq("id", organizationId)
            .eq("kind", "partner"),
        );
      }
    }

    return NextResponse.json({
      ok: true,
      suspended: {
        partnerId: id,
        authUserIds: removalContext.authUserIds,
        organizationIds: removalContext.organizationIds,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not remove service partner.",
      },
      { status: 500 },
    );
  }
}

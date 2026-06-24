import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateSlug(companyName: string): string {
  const cleaned = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `partner-${cleaned}`;
}

const partnerCreateSchema = z.object({
  packageStream: z.string().min(2),
  name: z.string().min(2), 
  companyName: z.string().min(2, "Company/Organization name is required."),
  site: z.string().min(3),
  email: z.string().email("A valid partner email is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

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

export async function GET() {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const [
      { data: packages, error: packagesError },
      { data: partners, error: partnersError },
    ] = await Promise.all([
      auth.admin
        .from("service_packages")
        .select("code, name, metadata")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      auth.admin
        .from("service_partners")
        .select("id, package_stream, name, site, is_active")
        .eq("is_active", true)
        .order("package_stream", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (packagesError || partnersError) {
      return NextResponse.json(
        {
          error:
            packagesError?.message ??
            partnersError?.message ??
            "Could not load service partner data.",
        },
        { status: 500 },
      );
    }

    const streamSet = new Set<string>();

    for (const pkg of packages ?? []) {
      const metadata =
        typeof pkg.metadata === "object" && pkg.metadata !== null
          ? (pkg.metadata as { streams?: Record<string, unknown> })
          : null;
      const streams = metadata?.streams;
      if (streams && typeof streams === "object") {
        Object.keys(streams).forEach((streamName) => streamSet.add(streamName));
      }
    }

    for (const partner of partners ?? []) {
      streamSet.add(partner.package_stream);
    }

    return NextResponse.json({
      streams: Array.from(streamSet).sort((a, b) => a.localeCompare(b)),
      partners: (partners ?? []).map((partner) => ({
        id: partner.id,
        packageStream: partner.package_stream,
        name: partner.name,
        site: partner.site,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load service partner data.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let createdOrgId: string | null = null;
  let createdAuthUserId: string | null = null;
  let profileCreated = false;
  let membershipCreated = false;

  const auth = await requireAdminOrStaff();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const payload = partnerCreateSchema.parse(await request.json());
    const orgSlug = generateSlug(payload.companyName);

    // =========================================================================
    // STEP 1: Provision the Business Entity (public.organizations)
    // =========================================================================
    const { data: orgData, error: orgError } = await auth.admin
      .from("organizations")
      .insert({
        name: payload.companyName,
        kind: "partner", 
        slug: orgSlug, 
        status: "active", 
        primary_contact_name: payload.name,
        primary_contact_email: payload.email,
        metadata: { source: "admin-dashboard-provision", created_at: new Date().toISOString() }
      })
      .select("id")
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: orgError?.message || "Could not provision the organization record." },
        { status: 400 }
      );
    }

    createdOrgId = orgData.id;

    // =========================================================================
    // STEP 2: Provision User Login Credentials (auth.users)
    // =========================================================================
    const { data: authUser, error: authError } = await auth.admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      app_metadata: { role: "partner" },
      user_metadata: {
        full_name: payload.name,
        role: "partner",
      },
    });

    if (authError || !authUser.user) {
      throw authError ?? new Error("Could not create secure authentication profile.");
    }

    createdAuthUserId = authUser.user.id;
    const servicePartnerId = createdAuthUserId;

    const { error: metadataError } = await auth.admin.auth.admin.updateUserById(
      createdAuthUserId,
      {
        app_metadata: {
          role: "partner",
          service_partner_id: servicePartnerId,
        },
        user_metadata: {
          full_name: payload.name,
          role: "partner",
          service_partner_id: servicePartnerId,
        },
      },
    );

    if (metadataError) throw metadataError;

    // =========================================================================
    // STEP 3: Establish the User Profile (public.user_profiles)
    // =========================================================================
    const { error: profileError } = await auth.admin
      .from("user_profiles")
      .insert({
        user_id: createdAuthUserId,
        organization_id: createdOrgId,
        full_name: payload.name,
        email: payload.email,
        role: "partner", 
        membership_status: "active",
        invited_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        metadata: {
          source: "admin-dashboard-provision",
          service_partner_id: servicePartnerId,
        },
      });

    if (profileError) throw profileError;
    profileCreated = true;

    // =========================================================================
    // STEP 4: Set Workspace Tenancy Membership (public.organization_memberships)
    // =========================================================================
    const { error: membershipError } = await auth.admin
      .from("organization_memberships")
      .insert({
        organization_id: createdOrgId,
        user_id: createdAuthUserId,
        email: payload.email, 
        role: "partner", 
        status: "active",
        is_primary: true, 
        metadata: {
          source: "admin-dashboard-provision",
          service_partner_id: servicePartnerId,
        },
      });

    if (membershipError) throw membershipError;
    membershipCreated = true;

    // =========================================================================
    // STEP 5: Populate Marketplace Router Entry (public.service_partners)
    // =========================================================================
    const { data: partnerData, error: partnerError } = await auth.admin
      .from("service_partners")
      .insert({
        id: servicePartnerId,
        package_stream: payload.packageStream,
        name: payload.companyName, 
        site: payload.site,
        is_active: true,
        metadata: { 
          email: payload.email, 
          contact_name: payload.name 
        }
      })
      .select("id, package_stream, name, site")
      .single();

    if (partnerError || !partnerData) {
      throw partnerError ?? new Error("Fulfillment routing context write failed.");
    }

    return NextResponse.json({
      partner: {
        id: partnerData.id,
        organizationId: createdOrgId,
        packageStream: partnerData.package_stream,
        name: partnerData.name,
        site: partnerData.site,
        email: payload.email
      },
    });

  } catch (error) {
    // ↩️ TRANSACTION ROLLBACK
    if (membershipCreated && createdOrgId && createdAuthUserId) {
      await auth.admin.from("organization_memberships").delete().eq("organization_id", createdOrgId).eq("user_id", createdAuthUserId);
    }
    if (profileCreated && createdAuthUserId) {
      await auth.admin.from("user_profiles").delete().eq("user_id", createdAuthUserId);
    }
    if (createdAuthUserId) {
      await auth.admin.auth.admin.deleteUser(createdAuthUserId);
    }
    if (createdOrgId) {
      await auth.admin.from("organizations").delete().eq("id", createdOrgId);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid schema parameters received." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create fully synchronized partner organization." },
      { status: 500 },
    );
  }
}

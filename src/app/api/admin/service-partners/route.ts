import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const partnerCreateSchema = z.object({
  packageStream: z.string().min(2),
  name: z.string().min(2),
  site: z.string().min(3),
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
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const payload = partnerCreateSchema.parse(await request.json());

    const { data, error } = await auth.admin
      .from("service_partners")
      .insert({
        package_stream: payload.packageStream,
        name: payload.name,
        site: payload.site,
      })
      .select("id, package_stream, name, site")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create service partner." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      partner: {
        id: data.id,
        packageStream: data.package_stream,
        name: data.name,
        site: data.site,
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
            : "Could not create service partner.",
      },
      { status: 500 },
    );
  }
}

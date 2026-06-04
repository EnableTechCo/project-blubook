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

    const { error } = await auth.admin
      .from("service_partners")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Could not remove service partner." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
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

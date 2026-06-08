import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const [{ data: profile }, { data: membership }] = await Promise.all([
      admin
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin
        .from("organization_memberships")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (!profile && !membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: requirementRows, error: requirementsError } = await admin
      .from("customer_requirement_items")
      .select(
        "id, package_stream, provider_id, title, description, why_required, evidence_type, is_required, status, status_reason, due_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("package_stream", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (requirementsError) {
      return NextResponse.json(
        { error: requirementsError.message },
        { status: 500 },
      );
    }

    const providerIds = Array.from(
      new Set(
        (requirementRows ?? [])
          .map((row) => row.provider_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const providerNamesById = new Map<string, string>();

    if (providerIds.length > 0) {
      const { data: providerRows, error: providersError } = await admin
        .from("service_partners")
        .select("id, name")
        .in("id", providerIds);

      if (providersError) {
        return NextResponse.json(
          { error: providersError.message },
          { status: 500 },
        );
      }

      for (const provider of providerRows ?? []) {
        providerNamesById.set(provider.id, provider.name);
      }
    }

    return NextResponse.json(
      (requirementRows ?? []).map((row) => ({
        id: row.id,
        packageStream: row.package_stream,
        providerName: row.provider_id
          ? (providerNamesById.get(row.provider_id) ?? null)
          : null,
        title: row.title,
        description: row.description,
        whyRequired: row.why_required,
        evidenceType: row.evidence_type,
        isRequired: row.is_required,
        status: row.status,
        statusReason: row.status_reason,
        dueAt: row.due_at,
        updatedAt: row.updated_at,
      })),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load customer requirements.",
      },
      { status: 500 },
    );
  }
}

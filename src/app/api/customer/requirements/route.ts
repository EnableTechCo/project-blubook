import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

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
    const status = url.searchParams.get("status")?.trim() ?? "";
    const requestedLimit = url.searchParams.get("limit");
    const requestedOffset = url.searchParams.get("offset");
    const hasPagingParams =
      requestedLimit !== null || requestedOffset !== null || status.length > 0;
    const limit = Math.min(Math.max(toPositiveInt(requestedLimit, 10), 1), 50);
    const offset = Math.max(toPositiveInt(requestedOffset, 0), 0);

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

    let requirementsQuery = admin
      .from("customer_requirement_items")
      .select(
        "id, package_stream, provider_id, title, description, why_required, evidence_type, is_required, status, status_reason, due_at, updated_at",
        hasPagingParams ? { count: "exact" } : undefined,
      )
      .eq("organization_id", organizationId)
      .order("package_stream", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (status.length > 0) {
      requirementsQuery = requirementsQuery.eq("status", status);
    }

    if (hasPagingParams) {
      requirementsQuery = requirementsQuery.range(offset, offset + limit - 1);
    }

    const {
      data: requirementRows,
      error: requirementsError,
      count,
    } = await requirementsQuery;

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

    const items = (requirementRows ?? []).map((row) => ({
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
    }));

    if (!hasPagingParams) {
      return NextResponse.json(items);
    }

    const total = count ?? 0;
    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      items,
      pagination: {
        limit,
        offset,
        total,
        totalPages,
        page: currentPage,
        hasPrevPage: offset > 0,
        hasNextPage: offset + items.length < total,
      },
    });
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

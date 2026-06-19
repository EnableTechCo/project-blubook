import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SalesOrderRow = {
  id: string;
  status: string;
  total_cents: number;
  currency_code: string;
  po_reference: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

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
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

function isCompletedStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes("delivered") || normalized.includes("complete");
}

function isTruthyParam(value: string | null) {
  return value === "1" || value === "true";
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status")?.trim().toLowerCase();
    const openOnly = isTruthyParam(url.searchParams.get("openOnly"));
    const completedOnly = isTruthyParam(url.searchParams.get("completedOnly"));
    const staleOpenOnly = isTruthyParam(url.searchParams.get("staleOpen"));
    const view = url.searchParams.get("view")?.trim().toLowerCase();

    const { data: salesOrders, error: salesOrdersError } = await auth.admin
      .from("sales_orders")
      .select(
        "id, status, total_cents, currency_code, po_reference, organization_id, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(250);

    if (salesOrdersError) {
      return NextResponse.json(
        { error: salesOrdersError.message },
        { status: 400 },
      );
    }

    const rows = (salesOrders ?? []) as SalesOrderRow[];

    const organizationIds = Array.from(
      new Set(
        rows
          .map((row) => row.organization_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let organizationRows: OrganizationRow[] = [];
    if (organizationIds.length > 0) {
      const { data: organizations, error: organizationsError } =
        await auth.admin
          .from("organizations")
          .select("id, name")
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

    const staleThreshold = Date.now() - 48 * 60 * 60 * 1000;

    const orders = rows.map((row) => ({
      id: row.id,
      status: row.status,
      totalCents: row.total_cents,
      currencyCode: row.currency_code,
      poReference: row.po_reference,
      customerName: organizationById.get(row.organization_id)?.name ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const filteredOrders = orders.filter((order) => {
      const normalizedStatus = order.status.toLowerCase();
      const completed = isCompletedStatus(order.status);
      const updatedTimestamp = Date.parse(order.updatedAt);
      const staleOpen =
        !completed &&
        Number.isFinite(updatedTimestamp) &&
        updatedTimestamp < staleThreshold;

      if (statusFilter && normalizedStatus !== statusFilter) {
        return false;
      }

      if (view === "active" && completed) {
        return false;
      }

      if (view === "completed" && !completed) {
        return false;
      }

      if (view === "stale" && !staleOpen) {
        return false;
      }

      if (openOnly && completed) {
        return false;
      }

      if (completedOnly && !completed) {
        return false;
      }

      if (staleOpenOnly && !staleOpen) {
        return false;
      }

      return true;
    });

    const statusCounts = filteredOrders.reduce<Record<string, number>>(
      (acc, order) => {
        const key = order.status || "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const completedCount = filteredOrders.filter((order) =>
      isCompletedStatus(order.status),
    ).length;
    const activeCount = Math.max(0, filteredOrders.length - completedCount);
    const staleOpenCount = filteredOrders.filter((order) => {
      if (isCompletedStatus(order.status)) {
        return false;
      }

      const updatedTimestamp = Date.parse(order.updatedAt);
      if (Number.isNaN(updatedTimestamp)) {
        return false;
      }

      return updatedTimestamp < staleThreshold;
    }).length;

    return NextResponse.json({
      metrics: {
        total: filteredOrders.length,
        active: activeCount,
        completed: completedCount,
        staleOpen: staleOpenCount,
      },
      byStatus: statusCounts,
      orders: filteredOrders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load sales pipeline.",
      },
      { status: 500 },
    );
  }
}

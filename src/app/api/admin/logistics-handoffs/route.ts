import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type HandoffRow = {
  id: string;
  sales_order_id: string | null;
  order_item_id: string | null;
  from_provider_id: string | null;
  to_provider_id: string | null;
  status: string;
  handoff_type: string | null;
  package_stream: string | null;
  assigned_at: string | null;
  completed_at: string | null;
};

type SalesOrderRow = {
  id: string;
  po_reference: string | null;
  status: string;
};

type ServicePartnerRow = {
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
    const staleOnly = isTruthyParam(url.searchParams.get("stale"));
    const activeOnly = isTruthyParam(url.searchParams.get("activeOnly"));

    const { data: handoffs, error: handoffsError } = await auth.admin
      .from("provider_workflow_handoffs")
      .select(
        "id, sales_order_id, order_item_id, from_provider_id, to_provider_id, status, handoff_type, package_stream, assigned_at, completed_at",
      )
      .order("assigned_at", { ascending: false })
      .limit(250);

    if (handoffsError) {
      return NextResponse.json(
        { error: handoffsError.message },
        { status: 400 },
      );
    }

    const handoffRows = (handoffs ?? []) as HandoffRow[];

    const salesOrderIds = Array.from(
      new Set(
        handoffRows
          .map((row) => row.sales_order_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let salesOrderRows: SalesOrderRow[] = [];
    if (salesOrderIds.length > 0) {
      const { data: salesOrders, error: salesOrdersError } = await auth.admin
        .from("sales_orders")
        .select("id, po_reference, status")
        .in("id", salesOrderIds);

      if (salesOrdersError) {
        return NextResponse.json(
          { error: salesOrdersError.message },
          { status: 400 },
        );
      }

      salesOrderRows = (salesOrders ?? []) as SalesOrderRow[];
    }

    const salesOrderById = new Map(salesOrderRows.map((row) => [row.id, row]));

    const providerIds = Array.from(
      new Set(
        handoffRows
          .flatMap((row) => [row.from_provider_id, row.to_provider_id])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let servicePartnerRows: ServicePartnerRow[] = [];
    if (providerIds.length > 0) {
      const { data: servicePartners, error: servicePartnersError } =
        await auth.admin
          .from("service_partners")
          .select("id, name")
          .in("id", providerIds);

      if (servicePartnersError) {
        return NextResponse.json(
          { error: servicePartnersError.message },
          { status: 400 },
        );
      }

      servicePartnerRows = (servicePartners ?? []) as ServicePartnerRow[];
    }

    const servicePartnerById = new Map(
      servicePartnerRows.map((row) => [row.id, row]),
    );

    const rows = handoffRows.map((handoff) => {
      const order = handoff.sales_order_id
        ? (salesOrderById.get(handoff.sales_order_id) ?? null)
        : null;
      const fromProvider = handoff.from_provider_id
        ? (servicePartnerById.get(handoff.from_provider_id) ?? null)
        : null;
      const toProvider = handoff.to_provider_id
        ? (servicePartnerById.get(handoff.to_provider_id) ?? null)
        : null;

      return {
        id: handoff.id,
        salesOrderId: handoff.sales_order_id,
        orderItemId: handoff.order_item_id,
        status: handoff.status,
        handoffType: handoff.handoff_type,
        packageStream: handoff.package_stream,
        assignedAt: handoff.assigned_at,
        completedAt: handoff.completed_at,
        poReference: order?.po_reference ?? null,
        salesOrderStatus: order?.status ?? null,
        fromProviderName: fromProvider?.name ?? null,
        toProviderName: toProvider?.name ?? null,
      };
    });

    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;

    const filteredRows = rows.filter((row) => {
      const normalizedStatus = row.status.toLowerCase();
      const completed = normalizedStatus === "completed";

      if (statusFilter && normalizedStatus !== statusFilter) {
        return false;
      }

      if (activeOnly && completed) {
        return false;
      }

      if (staleOnly) {
        if (completed) {
          return false;
        }

        const assignedAt = row.assignedAt ? Date.parse(row.assignedAt) : NaN;
        if (!Number.isFinite(assignedAt) || assignedAt >= staleThreshold) {
          return false;
        }
      }

      return true;
    });

    const statusCounts = filteredRows.reduce<Record<string, number>>(
      (acc, row) => {
        const key = row.status || "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return NextResponse.json({
      metrics: {
        total: filteredRows.length,
        pending: statusCounts.pending ?? 0,
        accepted: statusCounts.accepted ?? 0,
        inProgress: statusCounts.in_progress ?? 0,
        completed: statusCounts.completed ?? 0,
      },
      handoffs: filteredRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load logistics handoffs.",
      },
      { status: 500 },
    );
  }
}

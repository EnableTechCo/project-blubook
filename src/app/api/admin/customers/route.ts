import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  primary_contact_email: string | null;
  updated_at: string;
};

type SalesOrderRow = {
  organization_id: string;
  status: string;
  total_cents: number;
  currency_code: string;
  updated_at: string;
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

function isCompletedStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes("delivered") || normalized.includes("complete");
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { data: customers, error: customersError } = await auth.admin
      .from("organizations")
      .select("id, name, slug, status, primary_contact_email, updated_at")
      .eq("kind", "customer")
      .order("updated_at", { ascending: false });

    if (customersError) {
      return NextResponse.json(
        { error: customersError.message },
        { status: 400 },
      );
    }

    const customerRows = (customers ?? []) as OrgRow[];
    const orgIds = customerRows.map((org) => org.id);

    let orderRows: SalesOrderRow[] = [];
    if (orgIds.length > 0) {
      const { data: orders, error: ordersError } = await auth.admin
        .from("sales_orders")
        .select(
          "organization_id, status, total_cents, currency_code, updated_at",
        )
        .in("organization_id", orgIds);

      if (ordersError) {
        return NextResponse.json(
          { error: ordersError.message },
          { status: 400 },
        );
      }

      orderRows = (orders ?? []) as SalesOrderRow[];
    }

    const ordersByOrg = orderRows.reduce<
      Record<
        string,
        {
          active: number;
          completed: number;
          totalCents: number;
          currencyCode: string;
          lastOrderAt: string | null;
        }
      >
    >((acc, order) => {
      const key = order.organization_id;
      if (!acc[key]) {
        acc[key] = {
          active: 0,
          completed: 0,
          totalCents: 0,
          currencyCode: order.currency_code ?? "ZAR",
          lastOrderAt: null,
        };
      }

      if (isCompletedStatus(order.status)) {
        acc[key].completed += 1;
      } else {
        acc[key].active += 1;
      }

      acc[key].totalCents += order.total_cents ?? 0;

      if (
        order.updated_at &&
        (!acc[key].lastOrderAt || order.updated_at > acc[key].lastOrderAt)
      ) {
        acc[key].lastOrderAt = order.updated_at;
      }

      return acc;
    }, {});

    const rows = customerRows.map((org) => {
      const metrics = ordersByOrg[org.id] ?? {
        active: 0,
        completed: 0,
        totalCents: 0,
        currencyCode: "ZAR",
        lastOrderAt: null,
      };
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        primaryContactEmail: org.primary_contact_email,
        activeOrders: metrics.active,
        completedOrders: metrics.completed,
        totalOrders: metrics.active + metrics.completed,
        lifetimeValueCents: metrics.totalCents,
        currencyCode: metrics.currencyCode,
        lastOrderAt: metrics.lastOrderAt,
        updatedAt: org.updated_at,
      };
    });

    const summary = {
      total: rows.length,
      withActiveOrders: rows.filter((r) => r.activeOrders > 0).length,
      withNoOrders: rows.filter((r) => r.totalOrders === 0).length,
      active: rows.filter((r) => (r.status ?? "").toLowerCase() === "active")
        .length,
    };

    return NextResponse.json({ summary, customers: rows });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load customer activity.",
      },
      { status: 500 },
    );
  }
}

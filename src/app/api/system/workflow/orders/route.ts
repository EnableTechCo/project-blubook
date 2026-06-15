import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function resolveUserContext() {
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
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;

  if (!role || !["admin", "staff"].includes(role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  // Staff and admin manage cross-org orders — no organization filter needed.
  return { admin, organizationId: null as string | null };
}

export async function GET(request: Request) {
  const context = await resolveUserContext();
  if ("error" in context) return context.error;

  const { admin, organizationId } = context;
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (orderId) {
    let orderQuery = admin
      .from("sales_orders")
      .select(
        "id, status, total_cents, currency_code, po_reference, created_at, updated_at, metadata",
      )
      .eq("id", orderId);

    // When organizationId is set, scope to that org. Staff/admin have no org restriction.
    if (organizationId) {
      orderQuery = orderQuery.eq("organization_id", organizationId);
    }

    const { data: order, error: orderError } = await orderQuery.maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    if (!order) {
      return NextResponse.json({ order: null, items: [] });
    }

    const { data: items, error: itemsError } = await admin
      .from("sales_order_items")
      .select(
        "id, product_name, sku, quantity, unit_price_cents, fulfillment_route",
      )
      .eq("order_id", orderId);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    const { data: handoffs, error: handoffsError } = await admin
      .from("provider_workflow_handoffs")
      .select("id, status, package_stream, metadata")
      .eq("sales_order_id", orderId)
      .order("assigned_at", { ascending: true });

    if (handoffsError) {
      return NextResponse.json(
        { error: handoffsError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      order,
      items: items ?? [],
      partnerHandoffs: handoffs ?? [],
    });
  }

  let ordersQuery = admin
    .from("sales_orders")
    .select(
      "id, status, total_cents, currency_code, po_reference, created_at, updated_at, metadata",
    );

  // When organizationId is set, scope to that org. Staff/admin see all orders.
  if (organizationId) {
    ordersQuery = ordersQuery.eq("organization_id", organizationId);
  }

  const { data: orders, error } = await ordersQuery.order("created_at", {
    ascending: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const orderIds = (orders ?? []).map((order) => order.id);
  let partnerHandoffsByOrderId: Record<
    string,
    Array<{
      id: string;
      status: string;
      package_stream: string | null;
      metadata: Record<string, unknown> | null;
      assigned_at: string | null;
    }>
  > = {};

  if (orderIds.length > 0) {
    const { data: handoffs, error: handoffsError } = await admin
      .from("provider_workflow_handoffs")
      .select(
        "id, sales_order_id, status, package_stream, metadata, assigned_at",
      )
      .in("sales_order_id", orderIds)
      .order("assigned_at", { ascending: false });

    if (handoffsError) {
      return NextResponse.json(
        { error: handoffsError.message },
        { status: 400 },
      );
    }

    partnerHandoffsByOrderId = (handoffs ?? []).reduce<
      Record<
        string,
        Array<{
          id: string;
          status: string;
          package_stream: string | null;
          metadata: Record<string, unknown> | null;
          assigned_at: string | null;
        }>
      >
    >((acc, handoff) => {
      const key = handoff.sales_order_id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({
        id: handoff.id,
        status: handoff.status,
        package_stream: handoff.package_stream,
        metadata:
          handoff.metadata && typeof handoff.metadata === "object"
            ? (handoff.metadata as Record<string, unknown>)
            : null,
        assigned_at: handoff.assigned_at,
      });
      return acc;
    }, {});
  }

  return NextResponse.json({
    orders: orders ?? [],
    partnerHandoffsByOrderId,
  });
}

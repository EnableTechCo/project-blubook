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

  let organizationId = profile?.organization_id ?? null;
  const role = profile?.role ?? null;

  if (!organizationId) {
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    organizationId = membership?.organization_id ?? null;
  }

  if (!role || !["admin", "staff"].includes(role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (!organizationId) {
    return {
      error: NextResponse.json(
        { error: "No active organization found for user." },
        { status: 400 },
      ),
    };
  }

  return { admin, organizationId };
}

export async function GET(request: Request) {
  const context = await resolveUserContext();
  if ("error" in context) return context.error;

  const { admin, organizationId } = context;
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (orderId) {
    const { data: order, error: orderError } = await admin
      .from("sales_orders")
      .select(
        "id, status, total_cents, currency_code, po_reference, created_at, updated_at, metadata",
      )
      .eq("organization_id", organizationId)
      .eq("id", orderId)
      .maybeSingle();

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

  const { data: orders, error } = await admin
    .from("sales_orders")
    .select("id, status, total_cents, currency_code, po_reference, created_at, updated_at, metadata")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ orders: orders ?? [] });
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LOGISTICS_STATUSES = [
  "Order Received",
  "Order Transmitted to Warehouse",
  "Notify Customer",
  "Pack Items for Shipment",
  "Generate Shipping Label & Documentation",
  "Track Shipment In Transit",
  "Reroute Delivery",
  "Order Arrives at Destination",
  "Customer Receives & Signs POD",
  "BluBook System Updated",
  "Delivered",
] as const;

type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];

const TRANSITIONS: Record<
  string,
  {
    from: LogisticsStatus[];
    to: LogisticsStatus;
  }
> = {
  transmit_to_warehouse: {
    from: ["Order Received"],
    to: "Order Transmitted to Warehouse",
  },
  inventory_unavailable: {
    from: ["Order Transmitted to Warehouse"],
    to: "Notify Customer",
  },
  inventory_available: {
    from: ["Order Transmitted to Warehouse", "Notify Customer"],
    to: "Pack Items for Shipment",
  },
  accuracy_fail: {
    from: ["Pack Items for Shipment"],
    to: "Pack Items for Shipment",
  },
  accuracy_pass: {
    from: ["Pack Items for Shipment"],
    to: "Generate Shipping Label & Documentation",
  },
  assign_carrier: {
    from: ["Generate Shipping Label & Documentation"],
    to: "Track Shipment In Transit",
  },
  delivery_issue: {
    from: ["Track Shipment In Transit"],
    to: "Reroute Delivery",
  },
  reroute_complete: {
    from: ["Reroute Delivery"],
    to: "Track Shipment In Transit",
  },
  delivered: {
    from: ["Track Shipment In Transit"],
    to: "Order Arrives at Destination",
  },
  pod_signed: {
    from: ["Order Arrives at Destination"],
    to: "Customer Receives & Signs POD",
  },
  update_blubook: {
    from: ["Customer Receives & Signs POD"],
    to: "BluBook System Updated",
  },
  close_delivery: {
    from: ["BluBook System Updated"],
    to: "Delivered",
  },
};

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

  if (!role || !["admin", "staff", "logistics"].includes(role)) {
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

export async function GET() {
  const context = await resolveUserContext();
  if ("error" in context) {
    return context.error;
  }

  const { admin, organizationId } = context;
  const { data: shipments, error } = await admin
    .from("sales_orders")
    .select(
      "id, po_reference, status, total_cents, currency_code, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .in("status", [...LOGISTICS_STATUSES])
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ shipments: shipments ?? [] });
}

export async function POST(request: Request) {
  const context = await resolveUserContext();
  if ("error" in context) {
    return context.error;
  }

  const { admin, organizationId } = context;
  const body = await request.json().catch(() => null);
  const orderId = typeof body?.orderId === "string" ? body.orderId : null;
  const action = typeof body?.action === "string" ? body.action : null;

  if (!orderId || !action) {
    return NextResponse.json(
      { error: "orderId and action are required." },
      { status: 400 },
    );
  }

  const transition = TRANSITIONS[action];
  if (!transition) {
    return NextResponse.json(
      { error: `Unsupported logistics action: ${action}` },
      { status: 400 },
    );
  }

  const { data: order, error: orderError } = await admin
    .from("sales_orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const currentStatus = order.status as LogisticsStatus;
  if (!transition.from.includes(currentStatus)) {
    return NextResponse.json(
      {
        error: `Cannot perform '${action}' from status '${order.status}'.`,
      },
      { status: 400 },
    );
  }

  const { error: updateError } = await admin
    .from("sales_orders")
    .update({
      status: transition.to,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    orderId,
    from: currentStatus,
    to: transition.to,
    action,
  });
}

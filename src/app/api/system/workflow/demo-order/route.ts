import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWorkflowEvents } from "@/lib/workflow/engine";

async function drainWorkflowQueue(maxRuns = 5) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let run = 0; run < maxRuns; run += 1) {
    const batch = await processWorkflowEvents(20);
    processed += batch.processed;
    succeeded += batch.succeeded;
    failed += batch.failed;

    if (batch.processed === 0) {
      break;
    }
  }

  return { processed, succeeded, failed };
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to create a demo order and run workflow engine.",
  });
}

export async function POST(request: Request) {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!organizationId) {
    return NextResponse.json(
      { error: "No active organization found for user." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const poReference =
    typeof body?.poReference === "string" && body.poReference.trim().length > 0
      ? body.poReference.trim()
      : `PO-DEMO-${Date.now().toString().slice(-6)}`;

  const totalAmount = 149700;

  const { data: order, error: orderError } = await admin
    .from("sales_orders")
    .insert({
      organization_id: organizationId,
      status: "Purchase Order Received",
      total_cents: totalAmount,
      currency_code: "ZAR",
      po_reference: poReference,
    })
    .select("id, po_reference")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: orderError?.message ?? "Failed to create sales order." },
      { status: 400 },
    );
  }

  const items = [
    {
      order_id: order.id,
      product_name: "Widget Alpha (In Stock)",
      sku: "WID-ALPHA-01",
      quantity: 2,
      unit_price_cents: 25000,
      fulfillment_route: "pick",
    },
    {
      order_id: order.id,
      product_name: "Custom Gadget Beta (Made-to-Order)",
      sku: "GAD-BETA-CUST",
      quantity: 1,
      unit_price_cents: 69900,
      fulfillment_route: "produce",
    },
    {
      order_id: order.id,
      product_name: "Supplier Bolt Gamma (Outsourced)",
      sku: "BLT-GAMMA-09",
      quantity: 6,
      unit_price_cents: 4950,
      fulfillment_route: "order",
    },
  ];

  const { error: itemsError } = await admin
    .from("sales_order_items")
    .insert(items);
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  const { data: event, error: queueError } = await admin
    .from("workflow_events_queue")
    .insert({
      event_type: "order.created",
      payload: { orderId: order.id },
      status: "queued",
    })
    .select("id")
    .single();

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 400 });
  }

  const dispatch = await drainWorkflowQueue();

  return NextResponse.json({
    orderId: order.id,
    poReference: order.po_reference,
    queuedEventId: event?.id ?? null,
    dispatch,
  });
}

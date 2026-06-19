import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required." },
        { status: 400 },
      );
    }

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

    if (!organizationId) {
      const { data: membership } = await admin
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      organizationId = membership?.organization_id ?? null;
    }

    if (!organizationId || profile?.role !== "customer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: order, error: orderError } = await admin
      .from("sales_orders")
      .select("id, organization_id")
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const { data: orderItems, error: itemsError } = await admin
      .from("sales_order_items")
      .select("id")
      .eq("order_id", orderId);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    const orderItemIds = (orderItems ?? []).map((item) => item.id);

    if (orderItemIds.length > 0) {
      await Promise.all([
        admin
          .from("fulfillment_logs")
          .delete()
          .in("order_item_id", orderItemIds),
        admin.from("pick_tickets").delete().in("order_item_id", orderItemIds),
        admin.from("work_orders").delete().in("order_item_id", orderItemIds),
        admin
          .from("purchase_order_items")
          .delete()
          .in("order_item_id", orderItemIds),
        admin
          .from("provider_workflow_handoffs")
          .delete()
          .in("order_item_id", orderItemIds),
        admin
          .from("sales_partner_handoffs")
          .delete()
          .in("order_item_id", orderItemIds),
      ]);
    }

    await Promise.all([
      admin.from("purchase_orders").delete().eq("sales_order_id", orderId),
      admin
        .from("provider_workflow_handoffs")
        .delete()
        .eq("sales_order_id", orderId),
      admin
        .from("sales_partner_handoffs")
        .delete()
        .eq("sales_order_id", orderId),
      admin
        .from("workflow_events_queue")
        .delete()
        .eq("payload->>orderId", orderId),
      admin.from("notifications").delete().eq("metadata->>order_id", orderId),
    ]);

    const { data: requirementRows } = await admin
      .from("customer_requirement_items")
      .select("id, metadata")
      .eq("organization_id", organizationId)
      .eq("metadata->>sales_order_id", orderId);

    for (const row of requirementRows ?? []) {
      const metadata = asObject(row.metadata);
      delete metadata.sales_order_id;
      delete metadata.po_reference;
      delete metadata.workflow_kickoff_source;

      await admin
        .from("customer_requirement_items")
        .update({ metadata })
        .eq("id", row.id);
    }

    await admin.from("sales_order_items").delete().eq("order_id", orderId);

    const { error: orderDeleteError } = await admin
      .from("sales_orders")
      .delete()
      .eq("id", orderId)
      .eq("organization_id", organizationId);

    if (orderDeleteError) {
      return NextResponse.json(
        { error: orderDeleteError.message },
        { status: 400 },
      );
    }

    console.info("[customer-order-retract] order removed", {
      orderId,
      organizationId,
      orderItemCount: orderItemIds.length,
    });

    return NextResponse.json({ ok: true, orderId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not retract customer order.",
      },
      { status: 500 },
    );
  }
}

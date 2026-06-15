import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET() {
  try {
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

    const { data: orders, error } = await admin
      .from("sales_orders")
      .select(
        "id, status, total_cents, currency_code, po_reference, metadata, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const orderIds = (orders ?? []).map((order) => order.id);
    let completedHandoffAtByOrderId: Record<string, string> = {};

    if (orderIds.length > 0) {
      const { data: completedHandoffs, error: handoffsError } = await admin
        .from("provider_workflow_handoffs")
        .select("sales_order_id, completed_at")
        .in("sales_order_id", orderIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (handoffsError) {
        return NextResponse.json(
          { error: handoffsError.message },
          { status: 400 },
        );
      }

      completedHandoffAtByOrderId = (completedHandoffs ?? []).reduce<
        Record<string, string>
      >((acc, row) => {
        if (
          row.sales_order_id &&
          typeof row.sales_order_id === "string" &&
          !acc[row.sales_order_id]
        ) {
          acc[row.sales_order_id] =
            typeof row.completed_at === "string"
              ? row.completed_at
              : new Date().toISOString();
        }
        return acc;
      }, {});
    }

    return NextResponse.json({
      orders: (orders ?? []).map((order) => {
        const metadata = asObject(order.metadata);
        const timeline = Array.isArray(metadata.workflow_timeline)
          ? metadata.workflow_timeline.filter(Boolean)
          : [];

        const metadataDeliveredAt =
          typeof metadata.delivered_at === "string"
            ? metadata.delivered_at
            : null;
        const derivedDeliveredAt =
          completedHandoffAtByOrderId[order.id] ?? null;
        const deliveredAt = metadataDeliveredAt ?? derivedDeliveredAt;
        const derivedDelivered = Boolean(deliveredAt);
        const status =
          derivedDelivered && order.status !== "Cancelled"
            ? "Delivered"
            : order.status;

        const timelineWithDelivery =
          derivedDelivered &&
          !timeline.some(
            (entry) =>
              entry &&
              typeof entry === "object" &&
              "step" in (entry as Record<string, unknown>) &&
              (
                ((entry as Record<string, unknown>).step as
                  | string
                  | undefined) ?? ""
              )
                .toLowerCase()
                .trim() === "order_delivered",
          )
            ? [
                ...timeline,
                {
                  step: "order_delivered",
                  actor: "logistics",
                  at: deliveredAt,
                  message: `${order.po_reference ?? order.id} delivered (derived from completed logistics handoff).`,
                },
              ]
            : timeline;

        return {
          id: order.id,
          status,
          totalCents: order.total_cents,
          currencyCode: order.currency_code,
          poReference: order.po_reference,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          deliveredAt,
          deliveredTo:
            typeof metadata.delivered_to === "string"
              ? metadata.delivered_to
              : null,
          slaDueAt:
            typeof metadata.sla_due_at === "string"
              ? metadata.sla_due_at
              : null,
          slaStatus:
            typeof metadata.sla_status === "string"
              ? metadata.sla_status
              : null,
          timeline: timelineWithDelivery,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load customer orders.",
      },
      { status: 500 },
    );
  }
}

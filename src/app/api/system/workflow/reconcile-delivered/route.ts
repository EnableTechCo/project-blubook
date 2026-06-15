import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appendOrderTimeline,
  computeDeliveredOrderMetadata,
  readStringMetadata,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";
import { recordStepEvent } from "@/services/workflow-step-events.service";

type CompletedHandoffRow = {
  id: string;
  sales_order_id: string;
  completed_at: string | null;
  metadata: unknown;
};

type SalesOrderRow = {
  id: string;
  organization_id: string;
  status: string | null;
  po_reference: string | null;
  metadata: unknown;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

  return { admin, organizationId, userId: user.id };
}

export async function POST(request: Request) {
  const context = await resolveUserContext();
  if ("error" in context) {
    return context.error;
  }

  const { admin, organizationId, userId } = context;
  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
  } | null;
  const orderIdFilter =
    body && typeof body.orderId === "string" && body.orderId.trim().length > 0
      ? body.orderId.trim()
      : null;

  let handoffsQuery = admin
    .from("provider_workflow_handoffs")
    .select("id, sales_order_id, completed_at, metadata")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(200);

  if (orderIdFilter) {
    handoffsQuery = handoffsQuery.eq("sales_order_id", orderIdFilter);
  }

  const { data: completedHandoffsData, error: completedHandoffsError } =
    await handoffsQuery;

  if (completedHandoffsError) {
    return NextResponse.json(
      { error: completedHandoffsError.message },
      { status: 400 },
    );
  }

  const completedHandoffs = (completedHandoffsData ??
    []) as CompletedHandoffRow[];
  if (completedHandoffs.length === 0) {
    return NextResponse.json({
      ok: true,
      scanned: 0,
      reconciled: 0,
      skipped: 0,
      details: [],
    });
  }

  const orderIds = Array.from(
    new Set(
      completedHandoffs
        .map((handoff) => handoff.sales_order_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: ordersData, error: ordersError } = await admin
    .from("sales_orders")
    .select("id, organization_id, status, po_reference, metadata")
    .in("id", orderIds)
    .eq("organization_id", organizationId);

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 400 });
  }

  const orders = (ordersData ?? []) as SalesOrderRow[];
  const orderById = new Map(orders.map((order) => [order.id, order]));

  let reconciled = 0;
  let skipped = 0;
  const details: Array<{
    orderId: string;
    handoffId: string;
    action: "reconciled" | "skipped";
    reason: string;
    slaStatus?: string | null;
  }> = [];

  for (const handoff of completedHandoffs) {
    const order = orderById.get(handoff.sales_order_id);
    if (!order) {
      skipped += 1;
      details.push({
        orderId: handoff.sales_order_id,
        handoffId: handoff.id,
        action: "skipped",
        reason: "Order not found in your organization scope.",
      });
      continue;
    }

    const nowIso = new Date().toISOString();
    const deliveredAt = handoff.completed_at ?? nowIso;
    const handoffMetadata = asObject(handoff.metadata);
    const targetProviderName =
      typeof handoffMetadata.target_provider_name === "string" &&
      handoffMetadata.target_provider_name.length > 0
        ? handoffMetadata.target_provider_name
        : null;
    const deliveredTo =
      targetProviderName ??
      readStringMetadata(order.metadata, "current_logistics_partner_name") ??
      "customer";

    const baseMetadata = computeDeliveredOrderMetadata(
      withOrderLifecycleDefaults(order.metadata, { startedAt: deliveredAt }),
      {
        deliveredAt,
        deliveredTo,
      },
    );
    const finalSlaStatus =
      typeof baseMetadata.sla_status === "string"
        ? baseMetadata.sla_status
        : null;

    const existingTimeline = Array.isArray(
      asObject(order.metadata).workflow_timeline,
    )
      ? (asObject(order.metadata).workflow_timeline as Array<{
          step?: unknown;
        }>)
      : [];

    const hasDeliveredTimeline = existingTimeline.some(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as { step?: unknown }).step === "order_delivered",
    );

    const finalMetadata = hasDeliveredTimeline
      ? baseMetadata
      : appendOrderTimeline(baseMetadata, {
          step: "order_delivered",
          actor: "system",
          at: deliveredAt,
          message: `${order.po_reference ?? order.id} reconciled to delivered state. SLA ${finalSlaStatus ?? "met"}.`,
          details: {
            deliveredAt,
            deliveredTo,
            slaStatus: finalSlaStatus,
            source: "system/workflow/reconcile-delivered",
          },
        });

    const needsStatusFix = order.status !== "Delivered";
    const needsDeliveredAtFix =
      typeof asObject(order.metadata).delivered_at !== "string";
    const needsSlaFix = typeof asObject(order.metadata).sla_status !== "string";
    const needsTimelineFix = !hasDeliveredTimeline;

    if (
      !needsStatusFix &&
      !needsDeliveredAtFix &&
      !needsSlaFix &&
      !needsTimelineFix
    ) {
      skipped += 1;
      details.push({
        orderId: order.id,
        handoffId: handoff.id,
        action: "skipped",
        reason: "Already reconciled.",
        slaStatus:
          typeof asObject(order.metadata).sla_status === "string"
            ? (asObject(order.metadata).sla_status as string)
            : null,
      });
      continue;
    }

    const { error: updateError } = await admin
      .from("sales_orders")
      .update({
        status: "Delivered",
        metadata: finalMetadata,
        updated_at: deliveredAt,
      })
      .eq("id", order.id)
      .eq("organization_id", organizationId);

    if (updateError) {
      skipped += 1;
      details.push({
        orderId: order.id,
        handoffId: handoff.id,
        action: "skipped",
        reason: `Update failed: ${updateError.message}`,
      });
      continue;
    }

    try {
      await recordStepEvent({
        orderId: order.id,
        stepKey: "delivered",
        actorType: "system",
        actorId: userId,
        source: "system/workflow/reconcile-delivered",
        metadata: {
          handoffId: handoff.id,
          deliveredAt,
          deliveredTo,
          slaStatus: finalSlaStatus,
        },
      });
    } catch (stepEventError) {
      const message =
        stepEventError instanceof Error
          ? stepEventError.message
          : String(stepEventError);
      if (!message.includes("already been recorded")) {
        skipped += 1;
        details.push({
          orderId: order.id,
          handoffId: handoff.id,
          action: "skipped",
          reason: `Step event failed: ${message}`,
        });
        continue;
      }
    }

    reconciled += 1;
    details.push({
      orderId: order.id,
      handoffId: handoff.id,
      action: "reconciled",
      reason: "Delivered status, SLA metadata, and step-event synchronized.",
      slaStatus: finalSlaStatus,
    });
  }

  return NextResponse.json({
    ok: true,
    scanned: completedHandoffs.length,
    reconciled,
    skipped,
    details,
  });
}

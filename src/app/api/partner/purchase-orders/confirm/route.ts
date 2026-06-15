import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";
import {
  appendOrderTimeline,
  insertNotifications,
  resolveCustomerUserIds,
  resolvePartnerUserIds,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";

function readPartnerEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata as {
    contact_email?: unknown;
    partner_email?: unknown;
    email?: unknown;
  };

  const candidate =
    (typeof value.contact_email === "string" ? value.contact_email : null) ??
    (typeof value.partner_email === "string" ? value.partner_email : null) ??
    (typeof value.email === "string" ? value.email : null);

  return candidate && candidate.length > 0 ? candidate : null;
}

function readPreferredSalesPartnerEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as { preferred_sales_partner_email?: unknown })
    .preferred_sales_partner_email;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function resolveServicePartnerId(input: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  profileMetadata: unknown;
  profileOrganizationId: string | null;
  userMetadata: unknown;
}) {
  return resolveServicePartnerIdForPartnerUser({
    admin: input.admin,
    userId: input.userId,
    profileMetadata: input.profileMetadata,
    profileOrganizationId: input.profileOrganizationId,
    userMetadata: input.userMetadata,
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
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
    .select("role, metadata, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const servicePartnerId = await resolveServicePartnerId({
    admin,
    userId: user.id,
    profileMetadata: profile.metadata,
    profileOrganizationId: profile.organization_id ?? null,
    userMetadata: user.user_metadata,
  });

  if (!servicePartnerId) {
    return NextResponse.json(
      { error: "Partner profile is not mapped to a service partner." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const handoffId = typeof body?.handoffId === "string" ? body.handoffId : null;
  const salesOrderId =
    typeof body?.salesOrderId === "string" ? body.salesOrderId : null;

  console.info("[partner/purchase-orders/confirm] request", {
    userId: user.id,
    servicePartnerId,
    handoffId,
    salesOrderId,
  });

  if (!handoffId && !salesOrderId) {
    return NextResponse.json(
      { error: "handoffId or salesOrderId is required." },
      { status: 400 },
    );
  }

  const { data: servicePartner } = await admin
    .from("service_partners")
    .select("id, name, metadata")
    .eq("id", servicePartnerId)
    .maybeSingle();

  const salesPartnerName = servicePartner?.name ?? "Your sales partner";
  const servicePartnerEmail = readPartnerEmail(servicePartner?.metadata);

  if (!handoffId && salesOrderId) {
    console.info("[partner/purchase-orders/confirm] branch", {
      type: "direct-sales-order",
      salesOrderId,
    });

    const { data: order, error: orderError } = await admin
      .from("sales_orders")
      .select("id, po_reference, organization_id, metadata")
      .eq("id", salesOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Associated sales order not found." },
        { status: 404 },
      );
    }

    const preferredSalesPartnerEmail = readPreferredSalesPartnerEmail(
      order.metadata,
    );

    if (
      preferredSalesPartnerEmail &&
      servicePartnerEmail &&
      preferredSalesPartnerEmail !== servicePartnerEmail
    ) {
      console.warn("[partner/purchase-orders/confirm] assignment-mismatch", {
        salesOrderId,
        preferredSalesPartnerEmail,
        servicePartnerEmail,
      });
      return NextResponse.json(
        { error: "This purchase order is assigned to a different partner." },
        { status: 403 },
      );
    }

    const nowIso = new Date().toISOString();
    const poLabel = order.po_reference ?? order.id;

    const updatedMetadata = appendOrderTimeline(
      withOrderLifecycleDefaults(order.metadata),
      {
        step: "purchase_order_received",
        actor: "sales",
        at: nowIso,
        message: `${poLabel} was confirmed received by sales partner.`,
      },
    );

    await admin
      .from("sales_orders")
      .update({
        status: "Purchase Order Received",
        metadata: updatedMetadata,
        updated_at: nowIso,
      })
      .eq("id", order.id);

    const { data: logisticsHandoffs } = await admin
      .from("provider_workflow_handoffs")
      .select("id, status")
      .eq("sales_order_id", order.id)
      .order("assigned_at", { ascending: false })
      .limit(5);

    const [customerUserIds, salesUserIds] = await Promise.all([
      resolveCustomerUserIds(admin, order.organization_id),
      resolvePartnerUserIds(admin, [servicePartnerId]),
    ]);

    await insertNotifications(admin, [
      ...customerUserIds.map((userId) => ({
        userId,
        organizationId: order.organization_id,
        message: `${poLabel} has been confirmed received by ${salesPartnerName}. Sales validation is now required.`,
        metadata: {
          source: "purchase_order_confirmed",
          order_id: order.id,
        },
      })),
      ...salesUserIds.map((userId) => ({
        userId,
        organizationId: order.organization_id,
        message: `You confirmed receipt of ${poLabel}. Continue with manual sales validation to advance the workflow.`,
        metadata: {
          source: "purchase_order_confirmed",
          order_id: order.id,
        },
      })),
    ]);

    console.info("[partner/purchase-orders/confirm] success", {
      type: "direct-sales-order",
      salesOrderId: order.id,
      poReference: order.po_reference,
      requiresManualValidation: true,
      logisticsHandoffs: (logisticsHandoffs ?? []).map((row) => ({
        id: row.id,
        status: row.status,
      })),
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      poReference: order.po_reference,
      queuedEventId: null,
      dispatch: null,
      requiresManualValidation: true,
      logisticsHandoffs: logisticsHandoffs ?? [],
      newStatus: "Purchase Order Received",
    });
  }

  // Verify this handoff belongs to this partner as sender
  console.info("[partner/purchase-orders/confirm] branch", {
    type: "handoff",
    handoffId,
  });

  const { data: handoff, error: handoffError } = await admin
    .from("provider_workflow_handoffs")
    .select(
      "id, status, sales_order_id, organization_id, to_provider_id, from_provider_id",
    )
    .eq("id", handoffId)
    .eq("from_provider_id", servicePartnerId)
    .maybeSingle();

  if (handoffError || !handoff) {
    console.warn("[partner/purchase-orders/confirm] handoff-not-found", {
      handoffId,
      servicePartnerId,
      error: handoffError?.message ?? null,
    });
    return NextResponse.json(
      { error: "Purchase order handoff not found." },
      { status: 404 },
    );
  }

  if (handoff.status !== "pending") {
    console.warn("[partner/purchase-orders/confirm] handoff-conflict", {
      handoffId,
      status: handoff.status,
    });
    return NextResponse.json(
      { error: `Handoff is already in status: ${handoff.status}.` },
      { status: 409 },
    );
  }

  const { data: order, error: orderError } = await admin
    .from("sales_orders")
    .select("id, po_reference, organization_id, metadata")
    .eq("id", handoff.sales_order_id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Associated sales order not found." },
      { status: 404 },
    );
  }

  const nowIso = new Date().toISOString();
  const poLabel = order.po_reference ?? handoff.sales_order_id;

  const { error: handoffUpdateError } = await admin
    .from("provider_workflow_handoffs")
    .update({
      status: "accepted",
      accepted_at: nowIso,
    })
    .eq("id", handoff.id);

  if (handoffUpdateError) {
    return NextResponse.json(
      { error: handoffUpdateError.message },
      { status: 400 },
    );
  }

  // 1. Update sales order status to "Purchase Order Received"
  const updatedMetadata = appendOrderTimeline(
    withOrderLifecycleDefaults(order.metadata),
    {
      step: "purchase_order_received",
      actor: "sales",
      at: nowIso,
      message: `${poLabel} was confirmed received by sales partner.`,
    },
  );

  await admin
    .from("sales_orders")
    .update({
      status: "Purchase Order Received",
      metadata: updatedMetadata,
      updated_at: nowIso,
    })
    .eq("id", order.id);

  // 2. Notify customer, sales partner, and logistics partner

  const [customerUserIds, salesUserIds, logisticsUserIds] = await Promise.all([
    resolveCustomerUserIds(admin, order.organization_id),
    resolvePartnerUserIds(admin, [servicePartnerId]),
    resolvePartnerUserIds(admin, [handoff.to_provider_id]),
  ]);

  await insertNotifications(admin, [
    ...customerUserIds.map((userId) => ({
      userId,
      organizationId: order.organization_id,
      message: `${poLabel} has been confirmed received by ${salesPartnerName}. Your order is now in progress.`,
      metadata: {
        source: "purchase_order_confirmed",
        order_id: order.id,
        handoff_id: handoffId,
      },
    })),
    ...salesUserIds.map((userId) => ({
      userId,
      organizationId: order.organization_id,
      message: `You confirmed receipt of ${poLabel}. Customer and logistics have been notified.`,
      metadata: {
        source: "purchase_order_confirmed",
        order_id: order.id,
        handoff_id: handoffId,
      },
    })),
    ...logisticsUserIds.map((userId) => ({
      userId,
      organizationId: order.organization_id,
      message: `${poLabel} has been confirmed by sales. Prepare for incoming logistics handoff.`,
      metadata: {
        source: "purchase_order_confirmed",
        order_id: order.id,
        handoff_id: handoffId,
      },
    })),
  ]);

  console.info("[partner/purchase-orders/confirm] success", {
    type: "handoff",
    handoffId,
    orderId: order.id,
    poReference: order.po_reference,
    requiresManualValidation: true,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    handoffId,
    orderId: order.id,
    poReference: order.po_reference,
    newStatus: "Purchase Order Received",
    queuedEventId: null,
    dispatch: null,
    requiresManualValidation: true,
  });
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readServicePartnerId,
  resolveServicePartnerIdForPartnerUser,
} from "@/lib/workflow/partner-context";
import {
  appendOrderTimeline,
  computeDeliveredOrderMetadata,
  insertNotifications,
  resolveCustomerUserIds,
  resolvePartnerUserIds,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";
import { DELIVERED_PROOF_REQUIREMENTS } from "@/lib/workflow/workflow-step-contract";
import {
  getCompletedStepKeysForOrder,
  recordStepEvent,
} from "@/services/workflow-step-events.service";

function getRequiredDocumentKeys(requiredDocuments: unknown) {
  if (!Array.isArray(requiredDocuments)) {
    return [] as string[];
  }

  return requiredDocuments
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const key = (item as { key?: unknown }).key;
      return typeof key === "string" && key.length > 0 ? key : null;
    })
    .filter((value): value is string => Boolean(value));
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

async function requirePartnerContext() {
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
    .select("role, metadata, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "partner") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const servicePartnerId = await resolveServicePartnerId({
    admin,
    userId: user.id,
    profileMetadata: profile.metadata,
    profileOrganizationId: profile.organization_id ?? null,
    userMetadata: user.user_metadata,
  });

  if (!servicePartnerId) {
    return {
      error: NextResponse.json(
        { error: "Partner profile is not mapped to a service partner." },
        { status: 400 },
      ),
    };
  }

  const { data: memberships } = await admin
    .from("organization_memberships")
    .select("metadata")
    .eq("user_id", user.id)
    .eq("status", "active");

  const servicePartnerIds = Array.from(
    new Set([
      servicePartnerId,
      ...(memberships ?? [])
        .map((membership) => readServicePartnerId(membership.metadata))
        .filter((value): value is string => Boolean(value)),
    ]),
  );

  return {
    admin,
    userId: user.id,
    servicePartnerId,
    servicePartnerIds,
  };
}

async function updateOrderWithStatusFallback(input: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
  nextStatus: string;
  metadata: Record<string, unknown>;
}) {
  const updatedAt = new Date().toISOString();
  const { error: updateError } = await input.admin
    .from("sales_orders")
    .update({
      status: input.nextStatus,
      metadata: input.metadata,
      updated_at: updatedAt,
    })
    .eq("id", input.orderId);

  if (!updateError) {
    return null;
  }

  if (!updateError.message.includes("sales_orders_status_check")) {
    return updateError;
  }

  const { error: fallbackUpdateError } = await input.admin
    .from("sales_orders")
    .update({
      metadata: input.metadata,
      updated_at: updatedAt,
    })
    .eq("id", input.orderId);

  return fallbackUpdateError ?? null;
}

export async function GET() {
  const auth = await requirePartnerContext();
  if ("error" in auth) {
    return auth.error;
  }

  const { admin, servicePartnerId, servicePartnerIds } = auth;

  const handoffSelectClauseInbound = `
    id,
    handoff_type,
    status,
    package_stream,
    notes,
    assigned_at,
    metadata,
    sales_order_items (
      product_name,
      sku,
      quantity,
      sales_orders (
        id,
        po_reference,
        status,
        metadata
      )
    )
  `;
  const { data: inboundProviderHandoffs, error } = await admin
    .from("provider_workflow_handoffs")
    .select(handoffSelectClauseInbound)
    .in("to_provider_id", servicePartnerIds)
    .order("assigned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Also fetch outbound handoffs this partner dispatched to other providers
  const handoffSelectClause = `
    id,
    handoff_type,
    status,
    package_stream,
    notes,
    assigned_at,
    metadata,
    sales_order_items (
      product_name,
      sku,
      quantity,
      sales_orders (
        id,
        po_reference,
        status,
        metadata
      )
    )
  `;
  const { data: outboundProviderHandoffs, error: outboundError } = await admin
    .from("provider_workflow_handoffs")
    .select(handoffSelectClause)
    .in("from_provider_id", servicePartnerIds)
    .not("to_provider_id", "in", `(${servicePartnerIds.join(",")})`)
    .order("assigned_at", { ascending: false });

  if (outboundError) {
    return NextResponse.json({ error: outboundError.message }, { status: 400 });
  }

  const logRow = (row: (typeof inboundProviderHandoffs)[number]) => {
    const items = Array.isArray(row.sales_order_items)
      ? row.sales_order_items
      : row.sales_order_items
        ? [row.sales_order_items]
        : [];
    const order = items[0]?.sales_orders ?? null;
    const orderId =
      typeof order === "object" && order !== null && "id" in order
        ? (order as { id?: string }).id
        : null;
    const poRef =
      typeof order === "object" && order !== null && "po_reference" in order
        ? (order as { po_reference?: string | null }).po_reference
        : null;
    return {
      id: row.id,
      status: row.status,
      salesOrderId: orderId,
      poReference: poRef,
      assignedAt: row.assigned_at,
    };
  };

  console.info("[partner/work-orders] handoffs query", {
    servicePartnerId,
    servicePartnerIds,
    inboundCount: (inboundProviderHandoffs ?? []).length,
    outboundCount: (outboundProviderHandoffs ?? []).length,
    inbound: (inboundProviderHandoffs ?? []).map(logRow),
    outbound: (outboundProviderHandoffs ?? []).map(logRow),
  });

  return NextResponse.json({
    inboundProviderHandoffs: inboundProviderHandoffs ?? [],
    outboundProviderHandoffs: outboundProviderHandoffs ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requirePartnerContext();
  if ("error" in auth) {
    return auth.error;
  }

  const { admin, servicePartnerId, servicePartnerIds, userId } = auth;
  const body = await request.json().catch(() => null);
  const providerHandoffId =
    typeof body?.providerHandoffId === "string" ? body.providerHandoffId : null;
  const action = typeof body?.action === "string" ? body.action : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!providerHandoffId || !action) {
    return NextResponse.json(
      {
        error: "action and providerHandoffId are required.",
      },
      { status: 400 },
    );
  }

  if (action === "reject" && (!notes || notes.length === 0)) {
    return NextResponse.json(
      {
        error:
          "Rejection reason is required when returning a handoff to sales.",
      },
      { status: 400 },
    );
  }

  const { data: providerHandoff, error: providerHandoffError } = await admin
    .from("provider_workflow_handoffs")
    .select(
      "id, to_provider_id, from_provider_id, sales_order_id, organization_id, required_documents",
    )
    .eq("id", providerHandoffId)
    .maybeSingle();

  if (
    providerHandoffError ||
    !providerHandoff ||
    !servicePartnerIds.includes(providerHandoff.to_provider_id)
  ) {
    return NextResponse.json(
      { error: "Inbound provider handoff not found." },
      { status: 404 },
    );
  }

  const validatedProviderHandoff = providerHandoff;
  const handoffOrganizationId = validatedProviderHandoff.organization_id;
  const fromProviderId = validatedProviderHandoff.from_provider_id;

  const { data: order } = await admin
    .from("sales_orders")
    .select("id, po_reference, metadata")
    .eq("id", validatedProviderHandoff.sales_order_id)
    .maybeSingle();

  async function notifyLifecycleUpdate(message: string, source: string) {
    if (!order?.id) {
      return;
    }

    const customerUserIds = await resolveCustomerUserIds(
      admin,
      handoffOrganizationId,
    );
    const salesUserIds = await resolvePartnerUserIds(admin, [fromProviderId]);

    await insertNotifications(admin, [
      ...customerUserIds.map((userId) => ({
        userId,
        organizationId: handoffOrganizationId,
        message,
        metadata: {
          source,
          order_id: order.id,
          provider_handoff_id: providerHandoffId,
        },
      })),
      ...salesUserIds.map((userId) => ({
        userId,
        organizationId: handoffOrganizationId,
        message,
        metadata: {
          source,
          order_id: order.id,
          provider_handoff_id: providerHandoffId,
        },
      })),
    ]);
  }

  if (action === "accept") {
    if (order) {
      const metadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata),
        {
          step: "logistics_handoff_accepted",
          actor: "logistics",
          message: `${order.po_reference ?? order.id} was accepted by logistics.`,
        },
      );

      const orderUpdateError = await updateOrderWithStatusFallback({
        admin,
        orderId: order.id,
        nextStatus: "Service Provider Confirmed Order",
        metadata,
      });

      if (orderUpdateError) {
        return NextResponse.json(
          { error: orderUpdateError.message },
          { status: 400 },
        );
      }
    }

    const { error } = await admin
      .from("provider_workflow_handoffs")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        notes,
      })
      .eq("id", providerHandoffId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await notifyLifecycleUpdate(
      `${order?.po_reference ?? providerHandoff.sales_order_id} was accepted by logistics.`,
      "partner_work_order_accepted",
    );

    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (order) {
      const metadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata),
        {
          step: "logistics_handoff_returned_to_sales",
          actor: "logistics",
          message: `${order.po_reference ?? order.id} was returned to sales by logistics. Reason: ${notes}`,
        },
      );

      const orderUpdateError = await updateOrderWithStatusFallback({
        admin,
        orderId: order.id,
        nextStatus: "Inventory Reserved",
        metadata,
      });

      if (orderUpdateError) {
        return NextResponse.json(
          { error: orderUpdateError.message },
          { status: 400 },
        );
      }
    }

    const { error } = await admin
      .from("provider_workflow_handoffs")
      .update({
        status: "rejected",
        notes,
      })
      .eq("id", providerHandoffId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await notifyLifecycleUpdate(
      `${order?.po_reference ?? providerHandoff.sales_order_id} was returned to sales for reassignment. Reason: ${notes}`,
      "partner_work_order_rejected",
    );

    return NextResponse.json({ ok: true });
  }

  if (action === "start") {
    if (order) {
      const metadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata),
        {
          step: "logistics_fulfillment_started",
          actor: "logistics",
          message: `${order.po_reference ?? order.id} is now in logistics fulfillment.`,
        },
      );

      const orderUpdateError = await updateOrderWithStatusFallback({
        admin,
        orderId: order.id,
        nextStatus: "Logistics Fulfillment In Progress",
        metadata,
      });

      if (orderUpdateError) {
        return NextResponse.json(
          { error: orderUpdateError.message },
          { status: 400 },
        );
      }
    }

    const { error } = await admin
      .from("provider_workflow_handoffs")
      .update({
        status: "in_progress",
        notes,
      })
      .eq("id", providerHandoffId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await notifyLifecycleUpdate(
      `${order?.po_reference ?? providerHandoff.sales_order_id} is now in logistics fulfillment.`,
      "partner_work_order_started",
    );

    return NextResponse.json({ ok: true });
  }

  if (action === "rollback_start") {
    if (order) {
      const metadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata),
        {
          step: "logistics_fulfillment_rolled_back",
          actor: "logistics",
          message: `${order.po_reference ?? order.id} was moved back to warehouse processing started.`,
        },
      );

      const orderUpdateError = await updateOrderWithStatusFallback({
        admin,
        orderId: order.id,
        nextStatus: "Service Provider Confirmed Order",
        metadata,
      });

      if (orderUpdateError) {
        return NextResponse.json(
          { error: orderUpdateError.message },
          { status: 400 },
        );
      }
    }

    const { error } = await admin
      .from("provider_workflow_handoffs")
      .update({
        status: "accepted",
        notes,
      })
      .eq("id", providerHandoffId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await notifyLifecycleUpdate(
      `${order?.po_reference ?? providerHandoff.sales_order_id} was moved back to warehouse processing started.`,
      "partner_work_order_rolled_back",
    );

    return NextResponse.json({ ok: true });
  }

  const logisticsMilestoneConfig: Record<
    string,
    {
      stepKey: string;
      nextStatus: string;
      source: string;
      message: (orderRef: string) => string;
      notificationMessage: (orderRef: string) => string;
    }
  > = {
    notify_customer: {
      stepKey: "notify_customer",
      nextStatus: "Notify Customer",
      source: "partner_work_order_customer_notified",
      message: (orderRef) =>
        `${orderRef} customer notification sent by logistics.`,
      notificationMessage: (orderRef) =>
        `${orderRef} customer has been notified by logistics.`,
    },
    pack_items: {
      stepKey: "pack_items_for_shipment",
      nextStatus: "Pack Items for Shipment",
      source: "partner_work_order_items_packed",
      message: (orderRef) =>
        `${orderRef} items packed and verified by logistics.`,
      notificationMessage: (orderRef) =>
        `${orderRef} items have been packed for shipment.`,
    },
    in_transit: {
      stepKey: "track_shipment_in_transit",
      nextStatus: "Track Shipment In Transit",
      source: "partner_work_order_in_transit",
      message: (orderRef) => `${orderRef} shipment is now in transit.`,
      notificationMessage: (orderRef) =>
        `${orderRef} shipment is now in transit.`,
    },
    arrived: {
      stepKey: "order_arrives_at_destination",
      nextStatus: "Order Arrives at Destination",
      source: "partner_work_order_arrived_destination",
      message: (orderRef) => `${orderRef} arrived at destination.`,
      notificationMessage: (orderRef) =>
        `${orderRef} has arrived at destination.`,
    },
    pod_signed: {
      stepKey: "customer_receives_signs_pod",
      nextStatus: "Customer Receives & Signs POD",
      source: "partner_work_order_pod_signed",
      message: (orderRef) =>
        `${orderRef} proof of delivery captured by logistics.`,
      notificationMessage: (orderRef) =>
        `${orderRef} proof of delivery has been captured.`,
    },
    system_updated: {
      stepKey: "blubook_system_updated",
      nextStatus: "BluBook System Updated",
      source: "partner_work_order_system_updated",
      message: (orderRef) =>
        `${orderRef} logistics closeout synced in BluBook.`,
      notificationMessage: (orderRef) =>
        `${orderRef} logistics system closeout is complete.`,
    },
  };

  const milestone = logisticsMilestoneConfig[action];
  if (milestone) {
    if (order) {
      const orderRef = order.po_reference ?? order.id;
      const metadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata),
        {
          step: milestone.stepKey,
          actor: "logistics",
          message: milestone.message(orderRef),
        },
      );

      const orderUpdateError = await updateOrderWithStatusFallback({
        admin,
        orderId: order.id,
        nextStatus: milestone.nextStatus,
        metadata,
      });

      if (orderUpdateError) {
        return NextResponse.json(
          { error: orderUpdateError.message },
          { status: 400 },
        );
      }
    }

    const { error } = await admin
      .from("provider_workflow_handoffs")
      .update({
        status: "in_progress",
        notes,
      })
      .eq("id", providerHandoffId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await notifyLifecycleUpdate(
      milestone.notificationMessage(
        order?.po_reference ?? providerHandoff.sales_order_id,
      ),
      milestone.source,
    );

    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    const requiredCompletionSteps = [
      "customer_receives_signs_pod",
      "blubook_system_updated",
    ];

    const completedStepKeys = await getCompletedStepKeysForOrder(
      validatedProviderHandoff.sales_order_id,
    );
    const completedSet = new Set(completedStepKeys);
    const missingCompletionSteps = requiredCompletionSteps.filter(
      (stepKey) => !completedSet.has(stepKey),
    );

    if (missingCompletionSteps.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required workflow steps: ${missingCompletionSteps.join(
            ", ",
          )}`,
          code: "MISSING_REQUIRED_STEP_EVENTS",
          missingStepKeys: missingCompletionSteps,
          requiredStepKeys: requiredCompletionSteps,
        },
        { status: 409 },
      );
    }

    const requiredDocumentKeys = Array.from(
      new Set([
        ...getRequiredDocumentKeys(providerHandoff.required_documents),
        ...DELIVERED_PROOF_REQUIREMENTS,
      ]),
    );

    // Ensure minimum requirements are always enforced
    if (requiredDocumentKeys.length === 0) {
      // If there are somehow no required documents defined, require at least
      // proof-of-delivery as a fallback for any delivery completion
      requiredDocumentKeys.push("proof-of-delivery");
    }

    if (requiredDocumentKeys.length > 0) {
      const { data: uploadedDocuments, error: documentsError } = await admin
        .from("documents")
        .select("id, metadata")
        .like("path", `partners/${servicePartnerId}/%`)
        .in("metadata->>documentType", requiredDocumentKeys);

      if (documentsError) {
        return NextResponse.json(
          { error: documentsError.message },
          { status: 400 },
        );
      }

      const uploadedDocumentTypes = new Set(
        (uploadedDocuments ?? [])
          .map((document) => {
            const documentType = document.metadata?.documentType;
            return typeof documentType === "string" ? documentType : null;
          })
          .filter((value): value is string => Boolean(value)),
      );

      const missingDocumentKeys = requiredDocumentKeys.filter(
        (documentKey) => !uploadedDocumentTypes.has(documentKey),
      );

      if (missingDocumentKeys.length > 0) {
        return NextResponse.json(
          {
            error: `Missing required documents: ${missingDocumentKeys.join(
              ", ",
            )}`,
            code: "MISSING_REQUIRED_DOCUMENTS",
            missingDocumentKeys,
            uploadPath: "/partner/documents",
          },
          { status: 400 },
        );
      }
    }

    const completedAt = new Date().toISOString();

    const { error } = await admin
      .from("provider_workflow_handoffs")
      .update({
        status: "completed",
        completed_at: completedAt,
        notes,
      })
      .eq("id", providerHandoffId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let completionSlaStatus: string | null = null;

    if (order) {
      const orderRef = order.po_reference ?? order.id;
      const deliveredMetadata = computeDeliveredOrderMetadata(
        withOrderLifecycleDefaults(order.metadata),
        {
          deliveredAt: completedAt,
          deliveredTo: "customer",
        },
      );
      completionSlaStatus =
        typeof deliveredMetadata.sla_status === "string"
          ? deliveredMetadata.sla_status
          : null;

      const metadata = appendOrderTimeline(deliveredMetadata, {
        step: "order_delivered",
        actor: "logistics",
        at: completedAt,
        message: `${orderRef} was delivered. SLA ${completionSlaStatus ?? "met"}.`,
        details: {
          deliveredAt: completedAt,
          deliveredTo: "customer",
          slaStatus: completionSlaStatus,
        },
      });

      const orderUpdateError = await updateOrderWithStatusFallback({
        admin,
        orderId: order.id,
        nextStatus: "Delivered",
        metadata,
      });

      if (orderUpdateError) {
        return NextResponse.json(
          { error: orderUpdateError.message },
          { status: 400 },
        );
      }

      try {
        await recordStepEvent({
          orderId: order.id,
          stepKey: "delivered",
          actorType: "logistics",
          actorId: userId,
          source: "partner/work-orders:complete",
          metadata: {
            providerHandoffId,
            deliveredAt: completedAt,
            slaStatus: completionSlaStatus,
          },
        });
      } catch (stepEventError) {
        const message =
          stepEventError instanceof Error
            ? stepEventError.message
            : String(stepEventError);

        if (!message.includes("already been recorded")) {
          return NextResponse.json(
            { error: `Work order completed but step event failed: ${message}` },
            { status: 500 },
          );
        }
      }

      await notifyLifecycleUpdate(
        `${orderRef} marked as delivered. SLA ${completionSlaStatus ?? "met"}.`,
        "partner_work_order_completed",
      );
    }

    const { error: queueError } = await admin
      .from("workflow_events_queue")
      .insert({
        event_type: "order.delivered",
        payload: { orderId: validatedProviderHandoff.sales_order_id },
        status: "queued",
      });

    if (queueError) {
      return NextResponse.json({ error: queueError.message }, { status: 400 });
    }

    // Queue only — order.delivered advances to "Delivered" via explicit
    // dispatch (/api/system/workflow/dispatch), not auto-drain here.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";
import {
  appendOrderTimeline,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";
import { resolveServicePartnerForStream } from "@/lib/workflow/service-partner-routing";
import { recordStepEvent } from "@/services/workflow-step-events.service";
import {
  reserveStockForOrder,
  restoreStockForOrder,
} from "@/services/inventory.service";

const SALES_PARTNER_STREAM = "Sales Ops";
const LOGISTICS_PARTNER_STREAM = "Logistics";
const DEFAULT_LOGISTICS_PARTNER_NAME_HINT = "blubook logistics";

function readServicePartnerId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const servicePartnerId = (value as { service_partner_id?: unknown })
    .service_partner_id;
  return typeof servicePartnerId === "string" && servicePartnerId.length > 0
    ? servicePartnerId
    : null;
}

function readOrderTimelineSteps(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [] as string[];
  }

  const timeline = (metadata as { workflow_timeline?: unknown })
    .workflow_timeline;
  if (!Array.isArray(timeline)) {
    return [] as string[];
  }

  return timeline
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const step = (entry as { step?: unknown }).step;
      return typeof step === "string" && step.length > 0 ? step : null;
    })
    .filter((value): value is string => Boolean(value));
}

function resolveEffectiveSalesOrderStatus(input: {
  rawStatus: string;
  metadata: unknown;
}) {
  const steps = new Set(readOrderTimelineSteps(input.metadata));
  const normalizedRawStatus = input.rawStatus.trim().toLowerCase();

  // If logistics explicitly returned the handoff to sales, keep the order
  // at inventory-reserved stage so sales can recreate handoff.
  if (
    steps.has("logistics_handoff_returned_to_sales") ||
    normalizedRawStatus === "inventory reserved"
  ) {
    return "Inventory Reserved";
  }

  if (steps.has("logistics_handoff_created")) {
    return "Logistics Handoff Created";
  }
  if (steps.has("inventory_reserved")) {
    return "Inventory Reserved";
  }
  if (steps.has("order_validated")) {
    return "Order Validated";
  }
  if (steps.has("purchase_order_received")) {
    return "Purchase Order Received";
  }

  return input.rawStatus;
}

// Maps each explicit sales action to the required prior status and the resulting status.
const SALES_ADVANCE_TRANSITIONS: Record<
  string,
  {
    requiredStatus: string;
    resultStatus: string;
    timelineStep: string;
    actor: string;
  }
> = {
  validate: {
    requiredStatus: "Purchase Order Received",
    resultStatus: "Order Validated",
    timelineStep: "order_validated",
    actor: "sales",
  },
  reserve_inventory: {
    requiredStatus: "Order Validated",
    resultStatus: "Inventory Reserved",
    timelineStep: "inventory_reserved",
    actor: "sales",
  },
  create_handoff: {
    requiredStatus: "Inventory Reserved",
    resultStatus: "Logistics Handoff Created",
    timelineStep: "logistics_handoff_created",
    actor: "sales",
  },
  rollback_inventory: {
    requiredStatus: "Inventory Reserved",
    resultStatus: "Order Validated",
    timelineStep: "inventory_reservation_reverted",
    actor: "sales",
  },
  rollback_validation: {
    requiredStatus: "Order Validated",
    resultStatus: "Purchase Order Received",
    timelineStep: "order_validation_reverted",
    actor: "sales",
  },
  generate_invoice: {
    requiredStatus: "Logistics Handoff Created",
    resultStatus: "Invoice Generated",
    timelineStep: "invoice_generated",
    actor: "sales",
  },
  confirm_shipment: {
    requiredStatus: "Invoice Generated",
    resultStatus: "Shipment Created",
    timelineStep: "shipment_created",
    actor: "sales",
  },
};

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
    .select("role, metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["admin", "staff", "sales", "partner"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (profile.role === "partner") {
    const profileServicePartnerId = readServicePartnerId(profile.metadata);
    const userMetadataServicePartnerId = readServicePartnerId(
      user.user_metadata,
    );

    let partnerId = profileServicePartnerId ?? userMetadataServicePartnerId;

    if (!partnerId) {
      partnerId = await resolveServicePartnerIdForPartnerUser({
        admin,
        userId: user.id,
        profileMetadata: profile.metadata,
        userMetadata: user.user_metadata,
      });
    }

    if (!partnerId) {
      return NextResponse.json(
        { error: "Partner profile is not mapped to a service partner." },
        { status: 400 },
      );
    }

    const { data: servicePartner } = await admin
      .from("service_partners")
      .select("id, package_stream, is_active")
      .eq("id", partnerId)
      .maybeSingle();

    const stream = servicePartner?.package_stream?.toLowerCase() ?? "";
    const isSalesOpsPartner =
      servicePartner?.is_active === true &&
      (stream === SALES_PARTNER_STREAM.toLowerCase() ||
        stream.includes("sales"));

    if (!isSalesOpsPartner) {
      return NextResponse.json(
        {
          error:
            "Only Sales Ops partners can advance sales workflow control points.",
        },
        { status: 403 },
      );
    }
  }

  const body = await request.json().catch(() => null);
  const orderId = typeof body?.orderId === "string" ? body.orderId : null;
  const action = typeof body?.action === "string" ? body.action : null;
  const actorNotes =
    typeof body?.actorNotes === "string" ? body.actorNotes.trim() : "";
  const stepInputData =
    body?.stepInputData &&
    typeof body.stepInputData === "object" &&
    !Array.isArray(body.stepInputData)
      ? (body.stepInputData as Record<string, unknown>)
      : null;

  if (!orderId || !action) {
    return NextResponse.json(
      { error: "orderId and action are required." },
      { status: 400 },
    );
  }

  const transition = SALES_ADVANCE_TRANSITIONS[action];
  if (!transition) {
    return NextResponse.json(
      {
        error: `Unsupported sales action: ${action}. Valid actions: ${Object.keys(SALES_ADVANCE_TRANSITIONS).join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const { data: order, error: orderError } = await admin
    .from("sales_orders")
    .select("id, po_reference, organization_id, status, metadata")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const effectiveCurrentStatus = resolveEffectiveSalesOrderStatus({
    rawStatus: order.status,
    metadata: order.metadata,
  });

  if (effectiveCurrentStatus !== transition.requiredStatus) {
    return NextResponse.json(
      {
        error: `Cannot perform '${action}' from status '${effectiveCurrentStatus}'. Required status: '${transition.requiredStatus}'.`,
        currentStatus: effectiveCurrentStatus,
        requiredStatus: transition.requiredStatus,
      },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  let nextMetadataBase: Record<string, unknown> = withOrderLifecycleDefaults(
    order.metadata,
  );
  let createdHandoffIds: string[] = [];
  let logisticsPartnerName: string | null = null;
  let logisticsPartnerId: string | null = null;
  let salesPartnerId: string | null = null;
  let logisticsPartnerRoutingReason: string | null = null;
  let reusedExistingHandoff = false;
  let persistedStatus = transition.resultStatus;

  if (action === "rollback_inventory" || action === "rollback_validation") {
    const { data: handoffExists } = await admin
      .from("provider_workflow_handoffs")
      .select("id")
      .eq("sales_order_id", order.id)
      .limit(1)
      .maybeSingle();

    if (handoffExists?.id) {
      return NextResponse.json(
        {
          error:
            "Cannot move workflow backward after logistics handoff has been created.",
        },
        { status: 409 },
      );
    }

    if (action === "rollback_inventory") {
      try {
        await restoreStockForOrder(order.id, user.id, admin);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `Could not restore inventory: ${message}` },
          { status: 500 },
        );
      }
    }
  }

  if (action === "reserve_inventory") {
    const { data: orderItems, error: itemsError } = await admin
      .from("sales_order_items")
      .select("sku, quantity")
      .eq("order_id", order.id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    const items = (orderItems ?? [])
      .filter((item) => typeof item.sku === "string" && item.sku.length > 0)
      .map((item) => ({
        sku: item.sku as string,
        quantity: item.quantity as number,
      }));

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No stockable items found on this order to reserve." },
        { status: 400 },
      );
    }

    const result = await reserveStockForOrder(order.id, items, user.id, admin);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
  }

  if (action === "create_handoff") {
    const { data: existingActiveHandoff } = await admin
      .from("provider_workflow_handoffs")
      .select("id")
      .eq("sales_order_id", order.id)
      .in("status", ["pending", "accepted", "in_progress"])
      .limit(1)
      .maybeSingle();

    if (!existingActiveHandoff?.id) {
      const salesPartner = await resolveServicePartnerForStream({
        admin,
        stream: SALES_PARTNER_STREAM,
      });

      const selectedLogisticsPartnerId =
        typeof stepInputData?.logistics_partner_id === "string" &&
        stepInputData.logistics_partner_id.length > 0
          ? stepInputData.logistics_partner_id
          : null;

      const selectedLogisticsPartner = selectedLogisticsPartnerId
        ? await admin
            .from("service_partners")
            .select("id, name, package_stream, is_active")
            .eq("id", selectedLogisticsPartnerId)
            .maybeSingle()
        : { data: null, error: null };

      if (selectedLogisticsPartner?.error) {
        return NextResponse.json(
          { error: selectedLogisticsPartner.error.message },
          { status: 400 },
        );
      }

      const selectedPartnerStream =
        selectedLogisticsPartner.data?.package_stream?.toLowerCase() ?? "";
      const selectedIsLogistics =
        selectedLogisticsPartner.data?.is_active === true &&
        selectedPartnerStream.includes("logistics");

      const logisticsPartner = selectedIsLogistics
        ? {
            id: selectedLogisticsPartner.data!.id,
            name: selectedLogisticsPartner.data!.name,
            packageStream: selectedLogisticsPartner.data!.package_stream,
            selectionReason: "selected_in_step_input",
          }
        : await resolveServicePartnerForStream({
            admin,
            stream: LOGISTICS_PARTNER_STREAM,
            preferredNameHint: DEFAULT_LOGISTICS_PARTNER_NAME_HINT,
          });

      if (!salesPartner?.id) {
        return NextResponse.json(
          { error: "No active sales service partner available." },
          { status: 400 },
        );
      }

      if (!logisticsPartner?.id) {
        return NextResponse.json(
          { error: "No active logistics service partner available." },
          { status: 400 },
        );
      }

      const { data: orderItems, error: orderItemsError } = await admin
        .from("sales_order_items")
        .select("id, fulfillment_route, product_name")
        .eq("order_id", order.id)
        .eq("fulfillment_route", "order");

      if (orderItemsError) {
        return NextResponse.json(
          { error: orderItemsError.message },
          { status: 400 },
        );
      }

      const outsourcedItems = orderItems ?? [];
      if (outsourcedItems.length === 0) {
        return NextResponse.json(
          {
            error:
              "No outsourced order items were found to create a logistics handoff.",
          },
          { status: 400 },
        );
      }

      const requiredDocuments = [
        { key: "shipping-label", label: "Shipping Label" },
        { key: "proof-of-delivery", label: "Proof of Delivery" },
      ];

      salesPartnerId = salesPartner.id;
      logisticsPartnerName = logisticsPartner.name;
      logisticsPartnerId = logisticsPartner.id;
      logisticsPartnerRoutingReason = logisticsPartner.selectionReason;

      const handoffRows = outsourcedItems.map((item) => ({
        sales_order_id: order.id,
        order_item_id: item.id,
        organization_id: order.organization_id,
        from_provider_id: salesPartner.id,
        to_provider_id: logisticsPartner.id,
        handoff_type: "sales_to_logistics",
        package_stream: logisticsPartner.packageStream,
        status: "pending",
        assigned_at: nowIso,
        required_documents: requiredDocuments,
        metadata: {
          source_provider_name: salesPartner.name,
          target_provider_name: logisticsPartner.name,
          source_handoff_type: "sales/orders/advance:create_handoff",
          selected_logistics_partner_id: logisticsPartner.id,
          selected_logistics_partner_name: logisticsPartner.name,
          handoff_input_snapshot: stepInputData ?? {},
          handoff_actor_notes: actorNotes.length > 0 ? actorNotes : null,
          service_level:
            typeof stepInputData?.service_level === "string"
              ? stepInputData.service_level
              : null,
          special_handling_flags: Array.isArray(
            stepInputData?.special_handling_flags,
          )
            ? stepInputData?.special_handling_flags
            : [],
          delivery_window_preference:
            typeof stepInputData?.delivery_window_preference === "string"
              ? stepInputData.delivery_window_preference
              : null,
          item_name: item.product_name,
          fulfillment_route: item.fulfillment_route,
        },
      }));

      const { data: insertedHandoffs, error: handoffInsertError } = await admin
        .from("provider_workflow_handoffs")
        .insert(handoffRows)
        .select("id");

      if (handoffInsertError) {
        return NextResponse.json(
          { error: handoffInsertError.message },
          { status: 400 },
        );
      }

      createdHandoffIds = (insertedHandoffs ?? [])
        .map((row) => row.id)
        .filter((value): value is string => typeof value === "string");

      nextMetadataBase = {
        ...nextMetadataBase,
        current_logistics_partner_name: logisticsPartner.name,
      };
    } else {
      reusedExistingHandoff = true;
      createdHandoffIds = [existingActiveHandoff.id];

      const { data: existingHandoffDetail } = await admin
        .from("provider_workflow_handoffs")
        .select("metadata, from_provider_id, to_provider_id")
        .eq("id", existingActiveHandoff.id)
        .maybeSingle();

      salesPartnerId = existingHandoffDetail?.from_provider_id ?? null;
      logisticsPartnerId = existingHandoffDetail?.to_provider_id ?? null;

      const metadata = existingHandoffDetail?.metadata;
      if (
        metadata &&
        typeof metadata === "object" &&
        !Array.isArray(metadata)
      ) {
        const partnerName = (metadata as { target_provider_name?: unknown })
          .target_provider_name;
        logisticsPartnerName =
          typeof partnerName === "string" && partnerName.length > 0
            ? partnerName
            : null;
      }
    }
  }

  const updatedMetadata = appendOrderTimeline(nextMetadataBase, {
    step: transition.timelineStep,
    actor: transition.actor,
    at: nowIso,
    message: `${order.po_reference ?? order.id} advanced to ${transition.resultStatus} by ${transition.actor}.`,
  });

  const { error: updateError } = await admin
    .from("sales_orders")
    .update({
      status: transition.resultStatus,
      metadata: updatedMetadata,
      updated_at: nowIso,
    })
    .eq("id", order.id);

  if (
    updateError &&
    updateError.message.includes("sales_orders_status_check")
  ) {
    const { error: fallbackUpdateError } = await admin
      .from("sales_orders")
      .update({
        status: order.status,
        metadata: updatedMetadata,
        updated_at: nowIso,
      })
      .eq("id", order.id);

    if (!fallbackUpdateError) {
      persistedStatus = order.status;
    } else {
      return NextResponse.json(
        { error: fallbackUpdateError.message },
        { status: 400 },
      );
    }
  } else if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  try {
    await recordStepEvent({
      orderId: order.id,
      stepKey: transition.timelineStep,
      actorType: "sales",
      actorId: user.id,
      source: `sales/orders/advance:${action}`,
      metadata: {
        action,
        fromStatus: effectiveCurrentStatus,
        toStatus: persistedStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already been recorded")) {
      return NextResponse.json(
        { error: `Order advanced but step event failed: ${message}` },
        { status: 500 },
      );
    }
  }

  // For validate action, also queue the order.validated event so downstream
  // fulfillment setup (pick tickets, work orders, handoffs) can run when
  // the admin/staff explicitly triggers dispatch.
  if (action === "validate") {
    const { data: existingEvent } = await admin
      .from("workflow_events_queue")
      .select("id")
      .eq("event_type", "order.validated")
      .eq("payload->>orderId", order.id)
      .in("status", ["queued", "processing"])
      .limit(1)
      .maybeSingle();

    if (!existingEvent) {
      await admin.from("workflow_events_queue").insert({
        event_type: "order.validated",
        payload: { orderId: order.id },
        status: "queued",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    poReference: order.po_reference,
    from: order.status,
    to: persistedStatus,
    persistedStatus,
    action,
    handoff: {
      createdIds: createdHandoffIds,
      createdCount: createdHandoffIds.length,
      reusedExisting: reusedExistingHandoff,
      salesPartnerId,
      logisticsPartnerId,
      logisticsPartnerName,
      logisticsPartnerRoutingReason,
    },
  });
}

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
import { DELIVERED_PROOF_REQUIREMENTS } from "@/lib/workflow/workflow-step-contract";
import { getCompletedStepKeysForOrder } from "@/services/workflow-step-events.service";

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

  return { admin, userId: user.id, servicePartnerId };
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

  const { admin, servicePartnerId } = auth;
  const { data: inboundProviderHandoffs, error } = await admin
    .from("provider_workflow_handoffs")
    .select(
      `
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
    `,
    )
    .eq("to_provider_id", servicePartnerId)
    .order("assigned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.info("[partner/work-orders] inbound handoffs query", {
    servicePartnerId,
    rowCount: (inboundProviderHandoffs ?? []).length,
    rows: (inboundProviderHandoffs ?? []).map((row) => {
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
    }),
  });

  return NextResponse.json({
    inboundProviderHandoffs: inboundProviderHandoffs ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requirePartnerContext();
  if ("error" in auth) {
    return auth.error;
  }

  const { admin, servicePartnerId } = auth;
  const body = await request.json().catch(() => null);
  const providerHandoffId =
    typeof body?.providerHandoffId === "string" ? body.providerHandoffId : null;
  const action = typeof body?.action === "string" ? body.action : null;
  const notes = typeof body?.notes === "string" ? body.notes : null;

  if (!providerHandoffId || !action) {
    return NextResponse.json(
      {
        error: "action and providerHandoffId are required.",
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
    providerHandoff.to_provider_id !== servicePartnerId
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

    const { error } = await admin
      .from("provider_workflow_handoffs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        notes,
      })
      .eq("id", providerHandoffId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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

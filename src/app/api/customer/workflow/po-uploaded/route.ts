import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWorkflowEvents } from "@/lib/workflow/engine";
import {
  appendOrderTimeline,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";
import { resolveServicePartnerForStream } from "@/lib/workflow/service-partner-routing";

function isPurchaseOrderRequirement(input: {
  title: string;
  evidenceType: string;
}) {
  const title = input.title.toLowerCase();
  const evidenceType = input.evidenceType.toLowerCase();

  return (
    title.includes("purchase order") ||
    title.includes("purchase-order") ||
    evidenceType.includes("purchase_order") ||
    (evidenceType.includes("purchase") && evidenceType.includes("order"))
  );
}

function toSkuSegment(value: string) {
  const cleaned = value
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toUpperCase();
  return cleaned.length > 0 ? cleaned : "GEN";
}

function derivePoReference(fileName: string | null) {
  const cleaned = (fileName ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toUpperCase()
    .slice(0, 24);

  if (cleaned.length > 0) {
    return `PO-${cleaned}`;
  }

  return `PO-${Date.now().toString().slice(-8)}`;
}

function readPartnerEmail(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const metadata = value as Record<string, unknown>;
  const candidates = [
    metadata.email,
    metadata.contact_email,
    metadata.notification_email,
    metadata.partner_email,
  ];
  const found = candidates.find(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
  return found ?? null;
}

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

export async function POST(request: Request) {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const requirementItemId =
      typeof body?.requirementItemId === "string"
        ? body.requirementItemId
        : null;
    const uploadedFileName =
      typeof body?.fileName === "string" ? body.fileName : null;

    if (!requirementItemId) {
      return NextResponse.json(
        { error: "requirementItemId is required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: requirement, error: requirementError } = await admin
      .from("customer_requirement_items")
      .select(
        "id, organization_id, package_stream, provider_id, title, evidence_type, metadata",
      )
      .eq("id", requirementItemId)
      .maybeSingle();

    if (requirementError || !requirement) {
      return NextResponse.json(
        { error: "Requirement item not found." },
        { status: 404 },
      );
    }

    const [{ data: profile }, { data: membership }] = await Promise.all([
      admin
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("organization_id", requirement.organization_id)
        .maybeSingle(),
      admin
        .from("organization_memberships")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("organization_id", requirement.organization_id)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (!profile && !membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      !isPurchaseOrderRequirement({
        title: requirement.title,
        evidenceType: requirement.evidence_type,
      })
    ) {
      return NextResponse.json({ ok: true, skipped: true, reason: "not_po" });
    }

    const isE2EProvisionedRequirement =
      requirement.metadata?.source === "e2e-po-workflow-setup";

    const existingOrderId =
      !isE2EProvisionedRequirement &&
      typeof requirement.metadata?.sales_order_id === "string"
        ? requirement.metadata.sales_order_id
        : null;

    let salesOrderId: string | null = null;
    let poReference: string | null = null;
    let orderMetadata: Record<string, unknown> | null = null;

    if (requirement.provider_id) {
      const { data: requirementProvider } = await admin
        .from("service_partners")
        .select("metadata")
        .eq("id", requirement.provider_id)
        .eq("is_active", true)
        .maybeSingle();

      // provider_id resolved — no action needed; routing uses stream-based selection.
    }

    if (existingOrderId) {
      const { data: existingOrder } = await admin
        .from("sales_orders")
        .select("id, po_reference, status, created_at, metadata")
        .eq("id", existingOrderId)
        .maybeSingle();

      if (existingOrder?.id) {
        const timeline =
          existingOrder.metadata &&
          typeof existingOrder.metadata === "object" &&
          !Array.isArray(existingOrder.metadata)
            ? ((existingOrder.metadata as { workflow_timeline?: unknown })
                .workflow_timeline as Array<{ step?: string }> | undefined)
            : undefined;

        const hasDeliveredMarker =
          existingOrder.status === "Delivered" ||
          (timeline ?? []).some((entry) => entry.step === "order_delivered");

        const isFreshOrder =
          Date.now() - new Date(existingOrder.created_at).getTime() <
          30 * 60 * 1000;

        const { data: existingHandoff } = await admin
          .from("provider_workflow_handoffs")
          .select("id")
          .eq("sales_order_id", existingOrder.id)
          .limit(1)
          .maybeSingle();

        const canReuseExistingOrder =
          !hasDeliveredMarker &&
          existingOrder.status === "Purchase Order Received" &&
          !existingHandoff?.id &&
          isFreshOrder;

        if (canReuseExistingOrder) {
          salesOrderId = existingOrder.id;
          poReference = existingOrder.po_reference;
        }
      }
    }

    if (!salesOrderId) {
      poReference = derivePoReference(uploadedFileName);
      const nowIso = new Date().toISOString();
      orderMetadata = appendOrderTimeline(
        withOrderLifecycleDefaults(
          { workflow_kickoff_source: "customer_po_upload" },
          { startedAt: nowIso },
        ),
        {
          step: "customer_po_uploaded",
          actor: "customer",
          at: nowIso,
          message: `Customer uploaded purchase order ${poReference}.`,
          details: {
            requirementItemId,
            uploadedFileName,
          },
        },
      );
    }

    if (!salesOrderId) {
      const { data: createdOrder, error: createOrderError } = await admin
        .from("sales_orders")
        .insert({
          organization_id: requirement.organization_id,
          status: "Purchase Order Received",
          total_cents: 0,
          currency_code: "ZAR",
          po_reference: poReference,
          metadata: orderMetadata ?? {},
        })
        .select("id, po_reference")
        .single();

      if (createOrderError || !createdOrder) {
        return NextResponse.json(
          {
            error: createOrderError?.message ?? "Could not create sales order.",
          },
          { status: 400 },
        );
      }

      salesOrderId = createdOrder.id;
      poReference = createdOrder.po_reference;

      const streamSegment = toSkuSegment(requirement.package_stream);
      const { error: createItemError } = await admin
        .from("sales_order_items")
        .insert({
          order_id: createdOrder.id,
          product_name: `${requirement.package_stream} Service Package`,
          sku: `PKG-${streamSegment}-PO`,
          quantity: 1,
          unit_price_cents: 0,
          fulfillment_route: "order",
        });

      if (createItemError) {
        return NextResponse.json(
          { error: createItemError.message },
          { status: 400 },
        );
      }

      const mergedMetadata = {
        ...(requirement.metadata && typeof requirement.metadata === "object"
          ? requirement.metadata
          : {}),
        sales_order_id: createdOrder.id,
        po_reference: createdOrder.po_reference,
        workflow_kickoff_source: "customer_po_upload",
      };

      await admin
        .from("customer_requirement_items")
        .update({ metadata: mergedMetadata })
        .eq("id", requirement.id);

      // Resolve and assign the Sales Ops partner so they can see this order
      // in their dashboard without waiting for order.validated
      const salesOpsPartner = await resolveServicePartnerForStream({
        admin,
        stream: "Sales Ops",
      });

      if (salesOpsPartner) {
        const { data: partnerData } = await admin
          .from("service_partners")
          .select("metadata")
          .eq("id", salesOpsPartner.id)
          .maybeSingle();

        const partnerEmail = readPartnerEmail(partnerData?.metadata);

        if (partnerEmail) {
          // Update the order with the sales partner email so they can find it
          // in their dashboard via the direct sales orders query
          const { error: updateError } = await admin
            .from("sales_orders")
            .update({
              metadata: {
                ...orderMetadata,
                preferred_sales_partner_email: partnerEmail,
              },
            })
            .eq("id", salesOrderId);

          if (updateError) {
            console.warn(
              "[po-uploaded] could not set preferred_sales_partner_email",
              {
                salesOrderId,
                partnerEmail,
                error: updateError.message,
              },
            );
          }
        }
      }
    }

    const { data: existingKickoffEvent } = await admin
      .from("workflow_events_queue")
      .select("id")
      .eq("event_type", "order.created")
      .eq("payload->>orderId", salesOrderId)
      .in("status", ["queued", "processing", "completed"])
      .limit(1)
      .maybeSingle();

    let queuedEventId = existingKickoffEvent?.id ?? null;

    if (!queuedEventId) {
      const { data: queuedEvent, error: queueError } = await admin
        .from("workflow_events_queue")
        .insert({
          event_type: "order.created",
          payload: { orderId: salesOrderId },
          status: "queued",
        })
        .select("id")
        .single();

      if (queueError) {
        return NextResponse.json(
          { error: queueError.message },
          { status: 400 },
        );
      }

      queuedEventId = queuedEvent?.id ?? null;
    }

    // Queue only — do NOT drain here. Sales must explicitly advance via the
    // sales validation UI. Auto-drain was the root cause of workflow steps
    // appearing complete without partner interaction.
    const dispatch = { processed: 0, succeeded: 0, failed: 0 };

    const { data: providerHandoffs } = await admin
      .from("provider_workflow_handoffs")
      .select("id, status, package_stream, to_provider_id, from_provider_id")
      .eq("sales_order_id", salesOrderId)
      .order("assigned_at", { ascending: false });

    const providerIds = Array.from(
      new Set(
        (providerHandoffs ?? [])
          .flatMap((row) => [row.to_provider_id, row.from_provider_id])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const providerNameById = new Map<
      string,
      { name: string; stream: string }
    >();
    if (providerIds.length > 0) {
      const { data: providers } = await admin
        .from("service_partners")
        .select("id, name, package_stream")
        .in("id", providerIds);

      for (const provider of providers ?? []) {
        providerNameById.set(provider.id, {
          name: provider.name,
          stream: provider.package_stream,
        });
      }
    }

    const routing = (providerHandoffs ?? []).map((handoff) => ({
      handoffId: handoff.id,
      status: handoff.status,
      packageStream: handoff.package_stream,
      toProviderId: handoff.to_provider_id,
      toProviderName:
        providerNameById.get(handoff.to_provider_id)?.name ??
        handoff.to_provider_id,
      toProviderStream:
        providerNameById.get(handoff.to_provider_id)?.stream ??
        handoff.package_stream,
      fromProviderId: handoff.from_provider_id,
      fromProviderName:
        providerNameById.get(handoff.from_provider_id)?.name ??
        handoff.from_provider_id,
    }));

    console.info("[po-uploaded] routing summary", {
      requirementItemId,
      salesOrderId,
      poReference,
      dispatch,
      routing,
    });

    return NextResponse.json({
      ok: true,
      salesOrderId,
      poReference,
      queuedEventId,
      dispatch,
      routing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not process PO workflow kickoff.",
      },
      { status: 500 },
    );
  }
}

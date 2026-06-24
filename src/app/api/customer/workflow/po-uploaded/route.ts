import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email/dispatcher";
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

function toSearchableFileStem(value: string | null) {
  return (value ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
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

    // Variables scoped at the top-level of POST handler for asynchronous email capture access
    let salesOrderId: string | null = null;
    let poReference: string | null = null;
    let orderMetadata: Record<string, unknown> | null = null;
    let partnerEmail: string | null = null; 

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
          
          const existingEmail = (existingOrder.metadata as any)?.preferred_sales_partner_email;
          if (typeof existingEmail === "string") {
            partnerEmail = existingEmail;
          }
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

      // 🌐 DYNAMIC ROUTING: Lookup partner dynamically matching the requirement stream
      const assignedPartner = await resolveServicePartnerForStream({
        admin,
        stream: requirement.package_stream,
      });

      if (assignedPartner) {
        const { data: partnerData } = await admin
          .from("service_partners")
          .select("metadata")
          .eq("id", assignedPartner.id)
          .maybeSingle();

        partnerEmail = readPartnerEmail(partnerData?.metadata);

        if (partnerEmail) {
          await admin
            .from("sales_orders")
            .update({
              metadata: {
                ...orderMetadata,
                preferred_sales_partner_email: partnerEmail,
              },
            })
            .eq("id", salesOrderId);
        }
      }
    }

    const uploadedFileStem = toSearchableFileStem(uploadedFileName);
    const documentsQuery = admin
      .from("documents")
      .select("id, uploaded_by")
      .eq("organization_id", requirement.organization_id)
      .eq("uploaded_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: recentDocs } = uploadedFileStem
      ? await documentsQuery.ilike("file_name", `%${uploadedFileStem}%`)
      : await documentsQuery;

    const matchedDocument = (recentDocs ?? []).find(
      (doc): doc is { id: string; uploaded_by: string | null } =>
        Boolean(doc && typeof doc.id === "string"),
    );

    const purchaseOrderStatus = "submitted";
    const poUpsertMetadata = {
      source: "customer_po_upload",
      requirement_item_id: requirement.id,
      package_stream: requirement.package_stream,
    };

    const { error: purchaseOrderUpsertError } = await admin
      .from("purchase_orders")
      .upsert(
        {
          organization_id: requirement.organization_id,
          sales_order_id: salesOrderId,
          provider_id:
            typeof requirement.provider_id === "string"
              ? requirement.provider_id
              : null,
          po_number: poReference,
          customer_document_id:
            typeof matchedDocument?.id === "string" ? matchedDocument.id : null,
          status: purchaseOrderStatus,
          submitted_by:
            typeof matchedDocument?.uploaded_by === "string"
              ? matchedDocument.uploaded_by
              : user.id,
          metadata: poUpsertMetadata,
        },
        { onConflict: "sales_order_id" },
      );

    if (purchaseOrderUpsertError) {
      return NextResponse.json(
        { error: purchaseOrderUpsertError.message },
        { status: 400 },
      );
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

    // =========================================================================
    // 📨 DYNAMIC EMAIL TRIGGERS: Notify Partner & Confirm with Customer
    // =========================================================================
    try {
      const fallbackEmails: Record<string, string> = {
        "sales ops": "sales-ops@yourcompany.com",
        "logistics": "logistics@yourcompany.com",
        "compliance": "compliance@yourcompany.com",
      };
      
      const normalizedStream = (requirement.package_stream || "").toLowerCase();
      const fallbackEmail = fallbackEmails[normalizedStream] || "operations@yourcompany.com";

      // Trigger 1: Notify the Dynamic Service Provider Partner
      await queueEmail({
        templateKey: "sales-po-received",
        toEmail: partnerEmail || fallbackEmail, 
        organizationId: requirement.organization_id,
        subjectFallback: `New Purchase Order Submitted [${requirement.package_stream}]: ${poReference}`,
        payload: {
          sales_order_id: salesOrderId,
          po_number: poReference,
          package_stream: requirement.package_stream,
          user_id: user.id,
        },
      });

      // Trigger 2: Send a confirmation copy to the submitting Customer
      if (user.email) {
        await queueEmail({
          templateKey: "customer-po-submitted",
          toEmail: user.email, 
          organizationId: requirement.organization_id,
          subjectFallback: `We've received your Purchase Order: ${poReference}`,
          payload: {
            sales_order_id: salesOrderId,
            po_number: poReference,
            package_stream: requirement.package_stream,
          },
        });
      }
    } catch (emailQueueError) {
      console.warn("[po-uploaded] Failed to queue automated emails safely:", emailQueueError);
    }

    return NextResponse.json({
      ok: true,
      salesOrderId,
      poReference,
      queuedEventId,
      dispatch,
      routing,
    });
  } catch (error) {
    console.error("An error occurred:", error);
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
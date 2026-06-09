import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWorkflowEvents } from "@/lib/workflow/engine";
import {
  appendOrderTimeline,
  insertNotifications,
  resolveCustomerUserIds,
  resolvePartnerUserIds,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";

function readServicePartnerId(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const servicePartnerId = (value as { service_partner_id?: unknown })
    .service_partner_id;
  return typeof servicePartnerId === "string" && servicePartnerId.length > 0
    ? servicePartnerId
    : null;
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

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
  userEmail: string | null;
  profileMetadata: unknown;
  profileOrganizationId: string | null;
  userMetadata: unknown;
}) {
  const directId = firstNonEmpty([
    readServicePartnerId(input.profileMetadata),
    readServicePartnerId(input.userMetadata),
  ]);

  if (directId) {
    return directId;
  }

  const { data: memberships } = await input.admin
    .from("organization_memberships")
    .select("organization_id, metadata")
    .eq("user_id", input.userId)
    .eq("status", "active");

  const membershipId = firstNonEmpty(
    (memberships ?? []).map((row) => readServicePartnerId(row.metadata)),
  );
  if (membershipId) {
    return membershipId;
  }

  const organizationIds = Array.from(
    new Set(
      [
        input.profileOrganizationId,
        ...(memberships ?? []).map((row) => row.organization_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  if (organizationIds.length > 0) {
    const { data: organizations } = await input.admin
      .from("organizations")
      .select("id, metadata")
      .in("id", organizationIds);

    const organizationId = firstNonEmpty(
      (organizations ?? []).map((row) => readServicePartnerId(row.metadata)),
    );
    if (organizationId) {
      return organizationId;
    }
  }

  const { data: byMockAccountUser } = await input.admin
    .from("service_partners")
    .select("id")
    .eq("metadata->mock_account->>user_id", input.userId)
    .eq("is_active", true)
    .maybeSingle();

  if (byMockAccountUser?.id) {
    return byMockAccountUser.id;
  }

  for (const organizationId of organizationIds) {
    const { data: byMockAccountOrg } = await input.admin
      .from("service_partners")
      .select("id")
      .eq("metadata->mock_account->>organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle();

    if (byMockAccountOrg?.id) {
      return byMockAccountOrg.id;
    }
  }

  if (input.userEmail) {
    const { data: byMockAccountEmail } = await input.admin
      .from("service_partners")
      .select("id")
      .eq("metadata->mock_account->>email", input.userEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (byMockAccountEmail?.id) {
      return byMockAccountEmail.id;
    }
  }

  return null;
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
    userEmail: user.email ?? null,
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
          po_reference,
          status
        )
      )
    `,
    )
    .eq("to_provider_id", servicePartnerId)
    .order("assigned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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

    if (order) {
      const metadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata),
        {
          step: "logistics_handoff_accepted",
          actor: "logistics",
          message: `${order.po_reference ?? order.id} was accepted by logistics.`,
        },
      );

      await admin
        .from("sales_orders")
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq("id", order.id);
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

    if (order) {
      const metadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata),
        {
          step: "logistics_fulfillment_started",
          actor: "logistics",
          message: `${order.po_reference ?? order.id} is now in logistics fulfillment.`,
        },
      );

      await admin
        .from("sales_orders")
        .update({
          status: "Logistics Fulfillment In Progress",
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }

    await notifyLifecycleUpdate(
      `${order?.po_reference ?? providerHandoff.sales_order_id} is now in logistics fulfillment.`,
      "partner_work_order_started",
    );

    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    const requiredDocumentKeys = getRequiredDocumentKeys(
      providerHandoff.required_documents,
    );

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

    const dispatch = await drainWorkflowQueue(3);
    return NextResponse.json({ ok: true, dispatch });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";

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

type RawRequestRow = {
  id: string;
  provider_id: string;
  organization_id: string;
  package_id: string | null;
  package_stream: string;
  request_status: "sent" | "acknowledged" | "failed";
  sent_at: string;
  acknowledged_at: string | null;
  metadata: { provider_name?: string } | null;
  organizations?: { name?: string } | Array<{ name?: string }> | null;
  service_packages?:
    | { code?: string; name?: string }
    | Array<{ code?: string; name?: string }>
    | null;
};

type RawPoHandoffRow = {
  id: string;
  status: string;
  assigned_at: string;
  sales_order_id: string;
  from_provider_id?: string;
  to_provider_id?: string;
  metadata?: unknown;
  organizations?: { name?: string } | Array<{ name?: string }> | null;
  sales_orders?:
    | {
        po_reference?: string | null;
        status?: string | null;
        metadata?: unknown;
      }
    | Array<{
        po_reference?: string | null;
        status?: string | null;
        metadata?: unknown;
      }>
    | null;
};

type RawOrganizationRelation =
  | { name?: string }
  | Array<{ name?: string }>
  | null
  | undefined;

type RawRequirementRow = {
  id: string;
  organization_id: string;
  package_stream: string;
  provider_id: string | null;
  title: string;
  evidence_type: string;
  status: string;
  status_reason?: string | null;
  metadata?: unknown;
  is_required: boolean;
  updated_at: string;
};

type RawRequirementEvidenceRow = {
  id: string;
  requirement_item_id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  file_name: string | null;
  created_at: string;
};

type RawPriorityScoreRow = {
  organization_id: string;
  score: number;
  reason_summary: string | null;
  model_version: string | null;
  computed_at: string;
};

type RawIntelligenceProfileRow = {
  organization_id: string;
  confidence_score: number | null;
};

type RawDirectSalesOrderRow = {
  id: string;
  po_reference: string | null;
  status: string | null;
  metadata: unknown;
  updated_at: string;
  organizations?: { name?: string } | Array<{ name?: string }> | null;
};

const HIGH_READINESS_SCORE = 80;
const MEDIUM_READINESS_SCORE = 55;

type PartnerDecisionAction = "accept" | "reject";

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

  return {
    admin,
    servicePartnerId,
    partnerUserId: user.id,
    partnerUserEmail: user.email ?? null,
  };
}

function resolveOrganizationName(value: RawOrganizationRelation) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }

  return value.name ?? null;
}

function resolvePoReference(value: RawPoHandoffRow["sales_orders"]) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.po_reference ?? null;
  return value.po_reference ?? null;
}

function resolveOrderStatus(value: RawPoHandoffRow["sales_orders"]) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.status ?? null;
  return value.status ?? null;
}

function resolveEffectiveStatusFromTimeline(input: {
  orderStatus: string | null;
  orderTimeline: Array<{ step?: string }>;
}) {
  const steps = new Set(
    input.orderTimeline
      .map((entry) => entry.step)
      .filter((value): value is string => Boolean(value)),
  );

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

  return input.orderStatus;
}

function resolveEffectiveOutboundOrderStatus(input: {
  handoffStatus: string;
  orderStatus: string | null;
  orderTimeline: Array<{ step?: string }>;
}) {
  const timelineBackedStatus = resolveEffectiveStatusFromTimeline({
    orderStatus: input.orderStatus,
    orderTimeline: input.orderTimeline,
  });

  // Outbound: sales partner sent to logistics.
  // If logistics accepted or started, the order is past initial receipt.
  if (input.handoffStatus === "completed") {
    return timelineBackedStatus ?? "Delivered";
  }

  if (input.handoffStatus === "in_progress") {
    return "Logistics Fulfillment In Progress";
  }

  if (input.handoffStatus === "accepted") {
    return "Service Provider Confirmed Order";
  }

  // pending/rejected: use the raw order status but never show a stale
  // "Purchase Order Received" when a handoff already exists — that status
  // is only valid before any handoff was created.
  if (
    [
      "Purchase Order Received",
      "Order Validated",
      "Inventory Reserved",
    ].includes(timelineBackedStatus ?? "") &&
    input.handoffStatus === "pending"
  ) {
    return "Logistics Handoff Created";
  }

  return timelineBackedStatus;
}

function resolveEffectiveInboundOrderStatus(input: {
  handoffStatus: string;
  orderStatus: string | null;
}) {
  if (input.handoffStatus === "in_progress") {
    return "Logistics Fulfillment In Progress";
  }

  if (input.handoffStatus === "accepted") {
    return "Service Provider Confirmed Order";
  }

  if (input.handoffStatus === "completed") {
    return input.orderStatus ?? "Delivered";
  }

  return input.orderStatus;
}

function resolveDirectPurchaseOrderStatus(input: {
  orderStatus: string | null;
  orderTimeline: Array<{ step?: string }>;
}) {
  if (!input.orderStatus) {
    return "pending";
  }

  const normalized = input.orderStatus.toLowerCase();
  if (normalized.includes("purchase order received")) {
    const hasReceiptMarker = input.orderTimeline.some(
      (entry) => entry.step === "purchase_order_received",
    );
    return hasReceiptMarker ? "accepted" : "pending";
  }

  return "accepted";
}

function resolveOrderTimeline(value: RawPoHandoffRow["sales_orders"]) {
  const metadata = Array.isArray(value) ? value[0]?.metadata : value?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const timeline = (metadata as Record<string, unknown>).workflow_timeline;
  if (!Array.isArray(timeline)) {
    return [];
  }

  return timeline as Array<{ step?: string }>;
}

function resolveDirectOrderTimeline(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const timeline = (metadata as Record<string, unknown>).workflow_timeline;
  if (!Array.isArray(timeline)) {
    return [];
  }

  return timeline as Array<{ step?: string }>;
}

function isTerminalOrderStatus(orderStatus: string | null) {
  if (!orderStatus) {
    return false;
  }

  const normalized = orderStatus.trim().toLowerCase();
  return (
    normalized === "delivered" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  );
}

function isActiveOrderStatus(orderStatus: string | null) {
  if (!orderStatus) {
    return false;
  }

  return !isTerminalOrderStatus(orderStatus);
}

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

function readSalesOrderIdFromRequirementMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const salesOrderId = (metadata as { sales_order_id?: unknown })
    .sales_order_id;
  return typeof salesOrderId === "string" && salesOrderId.length > 0
    ? salesOrderId
    : null;
}

function resolvePackage(value: RawRequestRow["service_packages"]) {
  if (!value) {
    return { code: null, name: null };
  }

  if (Array.isArray(value)) {
    return {
      code: value[0]?.code ?? null,
      name: value[0]?.name ?? null,
    };
  }

  return {
    code: value.code ?? null,
    name: value.name ?? null,
  };
}

function computeDocsCompleteness(total: number, pending: number) {
  if (total <= 0) {
    return 100;
  }

  const submitted = Math.max(total - pending, 0);
  return Math.round((submitted / total) * 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function tierModifier(tierCode: string | null, tierName: string | null) {
  const normalized = `${tierCode ?? ""} ${tierName ?? ""}`.toLowerCase();
  if (normalized.includes("enterprise") || normalized.includes("strategic")) {
    return 8;
  }
  if (normalized.includes("pro") || normalized.includes("premium")) {
    return 5;
  }
  if (normalized.includes("growth") || normalized.includes("plus")) {
    return 2;
  }
  return 0;
}

function computeEffectiveScore(input: {
  baseScore: number | null;
  tierCode: string | null;
  tierName: string | null;
  streamMatch: boolean;
}) {
  const base = input.baseScore ?? 52;
  const tierAdjustment = tierModifier(input.tierCode, input.tierName);
  const streamAdjustment = input.streamMatch ? 4 : -5;
  return clamp(base + tierAdjustment + streamAdjustment, 0, 100);
}

function computeEffectiveConfidence(input: {
  baseConfidence: number | null;
  hasReason: boolean;
}) {
  const base = input.baseConfidence ?? 58;
  const blended = base + (input.hasReason ? 4 : 0);
  return clamp(Math.round(blended), 0, 100);
}

function buildReadinessAssessment(input: {
  score: number;
  confidence: number;
  docsCompleteness: number;
  reasonSummary: string | null;
  modelVersion: string | null;
}) {
  const { docsCompleteness, modelVersion } = input;
  const score = Number.isFinite(input.score) ? input.score : 45;
  const confidence = Number.isFinite(input.confidence) ? input.confidence : 55;

  const status =
    score >= HIGH_READINESS_SCORE
      ? "high"
      : score >= MEDIUM_READINESS_SCORE
        ? "medium"
        : "low";

  const label =
    status === "high"
      ? "High readiness"
      : status === "medium"
        ? "Moderate readiness"
        : "Low readiness";

  const reasons: string[] = [];
  if (status === "high") {
    reasons.push("This customer looks ready to get started.");
  } else if (status === "medium") {
    reasons.push("This customer looks promising but may need some guidance.");
  } else {
    reasons.push("This customer may need extra support before moving forward.");
  }
  if (confidence < 60) {
    reasons.push("Confidence is low right now, so use your judgment.");
  }

  return {
    status,
    label,
    score,
    confidence,
    reasons: reasons.slice(0, 2),
    modelVersion,
    docsCompleteness,
  };
}

export async function GET() {
  const auth = await requirePartnerContext();
  if ("error" in auth) {
    return auth.error;
  }

  const { admin, servicePartnerId } = auth;
  const { data: servicePartner } = await admin
    .from("service_partners")
    .select("id, name, package_stream, metadata")
    .eq("id", servicePartnerId)
    .maybeSingle();

  const servicePartnerEmail =
    servicePartner?.metadata &&
    typeof servicePartner.metadata === "object" &&
    !Array.isArray(servicePartner.metadata)
      ? (((servicePartner.metadata as { contact_email?: unknown })
          .contact_email as string | undefined) ??
        ((servicePartner.metadata as { partner_email?: unknown })
          .partner_email as string | undefined) ??
        ((servicePartner.metadata as { email?: unknown }).email as
          | string
          | undefined) ??
        null)
      : null;

  const { data, error } = await admin
    .from("customer_provider_requests")
    .select(
      `
      id,
      provider_id,
      organization_id,
      package_id,
      package_stream,
      request_status,
      sent_at,
      acknowledged_at,
      metadata,
      organizations (
        name
      ),
      service_packages (
        code,
        name
      )
    `,
    )
    .eq("provider_id", servicePartnerId)
    .order("sent_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: poHandoffsData, error: poHandoffsError } = await admin
    .from("provider_workflow_handoffs")
    .select(
      `
      id,
      status,
      assigned_at,
      sales_order_id,
      from_provider_id,
      to_provider_id,
      metadata,
      organizations (
        name
      ),
      sales_orders (
        po_reference,
        status,
        metadata
      )
    `,
    )
    .eq("from_provider_id", servicePartnerId)
    .order("assigned_at", { ascending: false })
    .limit(30);

  if (poHandoffsError) {
    return NextResponse.json(
      { error: poHandoffsError.message },
      { status: 400 },
    );
  }

  console.info("[partner/dashboard] outbound handoffs query", {
    servicePartnerId,
    rowCount: (poHandoffsData ?? []).length,
    rows: (poHandoffsData ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      salesOrderId: row.sales_order_id,
      fromProviderId: row.from_provider_id,
      toProviderId: row.to_provider_id,
      assignedAt: row.assigned_at,
    })),
  });

  const { data: inboundHandoffsData, error: inboundHandoffsError } = await admin
    .from("provider_workflow_handoffs")
    .select(
      `
      id,
      status,
      assigned_at,
      sales_order_id,
      from_provider_id,
      to_provider_id,
      organizations (
        name
      ),
      sales_orders (
        po_reference,
        status,
        metadata
      )
    `,
    )
    .eq("to_provider_id", servicePartnerId)
    .order("assigned_at", { ascending: false })
    .limit(30);

  if (inboundHandoffsError) {
    return NextResponse.json(
      { error: inboundHandoffsError.message },
      { status: 400 },
    );
  }

  console.info("[partner/dashboard] inbound handoffs query", {
    servicePartnerId,
    rowCount: (inboundHandoffsData ?? []).length,
    rows: (inboundHandoffsData ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      salesOrderId: row.sales_order_id,
      fromProviderId: row.from_provider_id,
      toProviderId: row.to_provider_id,
      assignedAt: row.assigned_at,
    })),
  });

  const servicePartnerLooksLogistics = [
    servicePartner?.package_stream,
    servicePartner?.name,
    servicePartnerEmail,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes("logistics"));

  if (
    servicePartnerLooksLogistics &&
    (inboundHandoffsData ?? []).length === 0
  ) {
    const {
      data: activeLogisticsHandoffs,
      error: activeLogisticsHandoffsError,
    } = await admin
      .from("provider_workflow_handoffs")
      .select(
        "id, status, sales_order_id, from_provider_id, to_provider_id, assigned_at",
      )
      .eq("package_stream", "Logistics")
      .in("status", ["pending", "accepted", "in_progress"])
      .order("assigned_at", { ascending: false })
      .limit(30);

    if (activeLogisticsHandoffsError) {
      console.warn(
        "[partner/dashboard] active logistics handoff diagnostics failed",
        {
          servicePartnerId,
          error: activeLogisticsHandoffsError.message,
        },
      );
    } else {
      const toProviderIds = Array.from(
        new Set(
          (activeLogisticsHandoffs ?? [])
            .map((row) => row.to_provider_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const { data: providersById } = toProviderIds.length
        ? await admin
            .from("service_partners")
            .select("id, name, package_stream")
            .in("id", toProviderIds)
        : { data: [] };

      const providerNameById = new Map(
        (providersById ?? []).map((row) => [
          row.id,
          {
            name: row.name,
            packageStream: row.package_stream,
          },
        ]),
      );

      console.info(
        "[partner/dashboard] logistics assignment mismatch diagnostics",
        {
          servicePartnerId,
          servicePartnerName: servicePartner?.name ?? null,
          servicePartnerEmail,
          activeLogisticsHandoffCount: (activeLogisticsHandoffs ?? []).length,
          sample: (activeLogisticsHandoffs ?? []).slice(0, 10).map((row) => ({
            id: row.id,
            status: row.status,
            salesOrderId: row.sales_order_id,
            fromProviderId: row.from_provider_id,
            toProviderId: row.to_provider_id,
            toProviderName:
              providerNameById.get(row.to_provider_id)?.name ??
              row.to_provider_id,
            toProviderStream:
              providerNameById.get(row.to_provider_id)?.packageStream ?? null,
            assignedAt: row.assigned_at,
          })),
        },
      );
    }
  }

  const { data: directSalesOrdersData, error: directSalesOrdersError } =
    servicePartnerEmail
      ? await admin
          .from("sales_orders")
          .select(
            `
      id,
      po_reference,
      status,
      metadata,
      updated_at,
      organizations (
        name
      )
    `,
          )
          .eq("metadata->>preferred_sales_partner_email", servicePartnerEmail)
          .order("updated_at", { ascending: false })
          .limit(30)
      : { data: [], error: null };

  if (directSalesOrdersError) {
    return NextResponse.json(
      { error: directSalesOrdersError.message },
      { status: 400 },
    );
  }

  const organizationIds = Array.from(
    new Set((data ?? []).map((row) => row.organization_id).filter(Boolean)),
  );

  let requirementsByOrgStreamProvider = new Map<
    string,
    { total: number; pending: number }
  >();
  let requirementRows: RawRequirementRow[] = [];
  let evidenceByRequirementId = new Map<
    string,
    Array<{
      id: string;
      fileName: string;
      storagePath: string | null;
      uploadedAt: string;
      signedUrl: string | null;
    }>
  >();

  const latestPriorityScoreByOrg = new Map<string, RawPriorityScoreRow>();
  const confidenceByOrg = new Map<string, number | null>();

  if (organizationIds.length > 0) {
    const { data: priorityScores, error: priorityScoresError } = await admin
      .from("customer_priority_scores")
      .select(
        "organization_id, score, reason_summary, model_version, computed_at",
      )
      .in("organization_id", organizationIds)
      .eq("is_active", true)
      .order("computed_at", { ascending: false });

    if (priorityScoresError) {
      return NextResponse.json(
        { error: priorityScoresError.message },
        { status: 400 },
      );
    }

    for (const row of (priorityScores ?? []) as RawPriorityScoreRow[]) {
      if (!latestPriorityScoreByOrg.has(row.organization_id)) {
        latestPriorityScoreByOrg.set(row.organization_id, row);
      }
    }

    const { data: intelligenceProfiles, error: intelligenceProfilesError } =
      await admin
        .from("customer_intelligence_profiles")
        .select("organization_id, confidence_score")
        .in("organization_id", organizationIds);

    if (intelligenceProfilesError) {
      return NextResponse.json(
        { error: intelligenceProfilesError.message },
        { status: 400 },
      );
    }

    for (const row of (intelligenceProfiles ??
      []) as RawIntelligenceProfileRow[]) {
      confidenceByOrg.set(row.organization_id, row.confidence_score);
    }
  }

  if (organizationIds.length > 0) {
    const { data: requirements, error: requirementsError } = await admin
      .from("customer_requirement_items")
      .select(
        "id, organization_id, package_stream, provider_id, title, evidence_type, status, status_reason, metadata, is_required, updated_at",
      )
      .in("organization_id", organizationIds)
      .eq("is_required", true);

    if (requirementsError) {
      return NextResponse.json(
        { error: requirementsError.message },
        { status: 400 },
      );
    }

    requirementRows = (requirements ?? []) as RawRequirementRow[];

    const requirementIds = requirementRows.map((row) => row.id);
    if (requirementIds.length > 0) {
      const { data: evidenceRows, error: evidenceError } = await admin
        .from("customer_requirement_evidence")
        .select(
          "id, requirement_item_id, storage_bucket, storage_path, file_name, created_at",
        )
        .in("requirement_item_id", requirementIds)
        .order("created_at", { ascending: false });

      if (evidenceError) {
        return NextResponse.json(
          { error: evidenceError.message },
          { status: 400 },
        );
      }

      const typedEvidenceRows = (evidenceRows ??
        []) as RawRequirementEvidenceRow[];

      const signedEvidenceRows = await Promise.all(
        typedEvidenceRows.map(async (row) => {
          let signedUrl: string | null = null;

          if (row.storage_bucket && row.storage_path) {
            const { data } = await admin.storage
              .from(row.storage_bucket)
              .createSignedUrl(row.storage_path, 60 * 30);
            signedUrl = data?.signedUrl ?? null;
          }

          return {
            id: row.id,
            requirementItemId: row.requirement_item_id,
            fileName: row.file_name ?? "Uploaded file",
            storagePath: row.storage_path,
            uploadedAt: row.created_at,
            signedUrl,
          };
        }),
      );

      evidenceByRequirementId = signedEvidenceRows.reduce(
        (acc, row) => {
          const current = acc.get(row.requirementItemId) ?? [];
          current.push({
            id: row.id,
            fileName: row.fileName,
            storagePath: row.storagePath,
            uploadedAt: row.uploadedAt,
            signedUrl: row.signedUrl,
          });
          acc.set(row.requirementItemId, current);
          return acc;
        },
        new Map<
          string,
          Array<{
            id: string;
            fileName: string;
            storagePath: string | null;
            uploadedAt: string;
            signedUrl: string | null;
          }>
        >(),
      );
    }

    requirementsByOrgStreamProvider = requirementRows.reduce((acc, row) => {
      const providerKey = row.provider_id ?? "__global__";
      const key = `${row.organization_id}:${row.package_stream}:${providerKey}`;
      const current = acc.get(key) ?? { total: 0, pending: 0 };
      const isPending = !["submitted", "approved"].includes(row.status);
      acc.set(key, {
        total: current.total + 1,
        pending: current.pending + (isPending ? 1 : 0),
      });
      return acc;
    }, new Map<string, { total: number; pending: number }>());
  }

  const requests = (data ?? []).map((row) => {
    const typed = row as unknown as RawRequestRow;
    const providerDocsKey = `${typed.organization_id}:${typed.package_stream}:${typed.provider_id}`;
    const globalDocsKey = `${typed.organization_id}:${typed.package_stream}:__global__`;
    const providerDocs = requirementsByOrgStreamProvider.get(
      providerDocsKey,
    ) ?? {
      total: 0,
      pending: 0,
    };
    const globalDocs = requirementsByOrgStreamProvider.get(globalDocsKey) ?? {
      total: 0,
      pending: 0,
    };
    const docs = {
      total: providerDocs.total + globalDocs.total,
      pending: providerDocs.pending + globalDocs.pending,
    };
    const docsCompleteness = computeDocsCompleteness(docs.total, docs.pending);
    const priorityScoreRow = latestPriorityScoreByOrg.get(
      typed.organization_id,
    );
    const rawConfidence = confidenceByOrg.get(typed.organization_id) ?? null;
    const packageTier = resolvePackage(typed.service_packages);
    const effectiveScore = computeEffectiveScore({
      baseScore: priorityScoreRow?.score ?? null,
      tierCode: packageTier.code,
      tierName: packageTier.name,
      streamMatch:
        !!servicePartner?.package_stream &&
        servicePartner.package_stream === typed.package_stream,
    });
    const effectiveConfidence = computeEffectiveConfidence({
      baseConfidence: rawConfidence,
      hasReason: Boolean(priorityScoreRow?.reason_summary),
    });

    const requirementItems = requirementRows
      .filter(
        (item) =>
          item.organization_id === typed.organization_id &&
          item.package_stream === typed.package_stream &&
          (item.provider_id === typed.provider_id ||
            item.provider_id === null) &&
          item.is_required,
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        evidenceType: item.evidence_type,
        status: item.status,
        statusReason:
          typeof item.status_reason === "string" ? item.status_reason : null,
        updatedAt: item.updated_at,
        uploadedFiles: evidenceByRequirementId.get(item.id) ?? [],
      }));

    return {
      id: typed.id,
      organizationId: typed.organization_id,
      organizationName: resolveOrganizationName(typed.organizations),
      packageId: typed.package_id,
      packageTierCode: packageTier.code,
      packageTierName: packageTier.name,
      packageStream: typed.package_stream,
      requestStatus: typed.request_status,
      sentAt: typed.sent_at,
      acknowledgedAt: typed.acknowledged_at,
      providerName: typed.metadata?.provider_name ?? null,
      requiredDocsTotal: docs.total,
      requiredDocsPending: docs.pending,
      aiReadiness: buildReadinessAssessment({
        score: effectiveScore,
        confidence: effectiveConfidence,
        docsCompleteness,
        reasonSummary: priorityScoreRow?.reason_summary ?? null,
        modelVersion: priorityScoreRow?.model_version ?? null,
      }),
      requirementItems,
    };
  });

  const summary = {
    total: requests.length,
    sent: requests.filter((item) => item.requestStatus === "sent").length,
    acknowledged: requests.filter(
      (item) => item.requestStatus === "acknowledged",
    ).length,
    failed: requests.filter((item) => item.requestStatus === "failed").length,
    pendingCustomerDocs: requests.filter(
      (item) =>
        item.requestStatus === "acknowledged" && item.requiredDocsPending > 0,
    ).length,
    readyForExecution: requests.filter(
      (item) =>
        item.requestStatus === "acknowledged" && item.requiredDocsPending === 0,
    ).length,
  };

  const seenSalesOrderIds = new Set<string>();
  const handoffPurchaseOrders = (poHandoffsData ?? [])
    .map((row) => {
      const typed = row as unknown as RawPoHandoffRow;
      const orderStatus = resolveOrderStatus(typed.sales_orders);
      return {
        id: typed.id,
        source: "handoff" as const,
        status: typed.status,
        assignedAt: typed.assigned_at,
        salesOrderId: typed.sales_order_id,
        poReference:
          resolvePoReference(typed.sales_orders) ?? typed.sales_order_id,
        organizationName: resolveOrganizationName(typed.organizations),
        orderStatus:
          typed.status === "rejected"
            ? "Inventory Reserved"
            : resolveEffectiveOutboundOrderStatus({
                handoffStatus: typed.status,
                orderStatus,
                orderTimeline: resolveOrderTimeline(typed.sales_orders),
              }),
        orderTimeline: resolveOrderTimeline(typed.sales_orders),
      };
    })
    // Exclude orphaned handoffs (deleted/retracted sales order) and terminal orders.
    .filter((item) => isActiveOrderStatus(item.orderStatus));

  const directPurchaseOrders = (directSalesOrdersData ?? []).map((row) => {
    const typed = row as unknown as RawDirectSalesOrderRow;
    const timeline = resolveDirectOrderTimeline(typed.metadata);
    const normalizedStatus = resolveDirectPurchaseOrderStatus({
      orderStatus: typed.status,
      orderTimeline: timeline,
    });

    return {
      id: `sales-order-${typed.id}`,
      source: "direct" as const,
      status: normalizedStatus,
      assignedAt: typed.updated_at,
      salesOrderId: typed.id,
      poReference: typed.po_reference ?? typed.id,
      organizationName: resolveOrganizationName(typed.organizations),
      orderStatus: resolveEffectiveStatusFromTimeline({
        orderStatus: typed.status,
        orderTimeline: timeline,
      }),
      orderTimeline: timeline,
    };
  });

  const purchaseOrders = [
    ...handoffPurchaseOrders,
    ...directPurchaseOrders,
  ].filter((item) => {
    if (seenSalesOrderIds.has(item.salesOrderId)) {
      return false;
    }

    seenSalesOrderIds.add(item.salesOrderId);
    return true;
  });

  const inboundSalesOrderIds = new Set(
    (inboundHandoffsData ?? [])
      .map((row) => {
        const typed = row as unknown as RawPoHandoffRow;
        return typed.sales_order_id;
      })
      .filter((value): value is string => Boolean(value)),
  );

  const purchaseOrderSalesOrderIds = new Set([
    ...purchaseOrders.map((item) => item.salesOrderId),
    ...Array.from(inboundSalesOrderIds),
  ]);
  const purchaseOrderRequirementBySalesOrderId = new Map<
    string,
    {
      requirementItemId: string;
      title: string;
      status: string;
      statusReason: string | null;
      updatedAt: string;
      evidence: Array<{
        id: string;
        fileName: string;
        uploadedAt: string;
        signedUrl: string | null;
      }>;
    }
  >();

  for (const requirement of requirementRows) {
    if (
      !isPurchaseOrderRequirement({
        title: requirement.title,
        evidenceType: requirement.evidence_type,
      })
    ) {
      continue;
    }

    const salesOrderId = readSalesOrderIdFromRequirementMetadata(
      requirement.metadata,
    );
    if (!salesOrderId || !purchaseOrderSalesOrderIds.has(salesOrderId)) {
      continue;
    }

    const current = purchaseOrderRequirementBySalesOrderId.get(salesOrderId);
    if (
      current &&
      new Date(current.updatedAt).getTime() >=
        new Date(requirement.updated_at).getTime()
    ) {
      continue;
    }

    const evidence = (evidenceByRequirementId.get(requirement.id) ?? [])
      .filter((item) => Boolean(item.signedUrl))
      .slice(0, 1)
      .map((item) => ({
        id: item.id,
        fileName: item.fileName,
        uploadedAt: item.uploadedAt,
        signedUrl: item.signedUrl,
      }));

    purchaseOrderRequirementBySalesOrderId.set(salesOrderId, {
      requirementItemId: requirement.id,
      title: requirement.title,
      status: requirement.status,
      statusReason: requirement.status_reason ?? null,
      updatedAt: requirement.updated_at,
      evidence,
    });
  }

  const purchaseOrdersWithRequirementEvidence = purchaseOrders.map((item) => ({
    ...item,
    purchaseOrderRequirement:
      purchaseOrderRequirementBySalesOrderId.get(item.salesOrderId) ?? null,
  }));

  console.info("[partner/dashboard] purchase-orders composition", {
    total: purchaseOrdersWithRequirementEvidence.length,
    rows: purchaseOrdersWithRequirementEvidence.map((item) => ({
      id: item.id,
      salesOrderId: item.salesOrderId,
      source: item.source,
      status: item.status,
      orderStatus: item.orderStatus,
      poRequirementStatus: item.purchaseOrderRequirement?.status ?? null,
      poEvidenceCount: item.purchaseOrderRequirement?.evidence.length ?? 0,
    })),
  });

  const activePurchaseOrders = purchaseOrdersWithRequirementEvidence.filter(
    (item) =>
      item.status !== "completed" && isActiveOrderStatus(item.orderStatus),
  );
  const pendingPurchaseOrders = purchaseOrdersWithRequirementEvidence.filter(
    (item) => item.status === "pending" || item.status === "rejected",
  );

  const inboundSeenSalesOrderIds = new Set<string>();
  const inboundWorkOrders = (inboundHandoffsData ?? [])
    .map((row) => {
      const typed = row as unknown as RawPoHandoffRow;
      const orderStatus = resolveOrderStatus(typed.sales_orders);
      return {
        id: typed.id,
        status: typed.status,
        assignedAt: typed.assigned_at,
        salesOrderId: typed.sales_order_id,
        poReference:
          resolvePoReference(typed.sales_orders) ?? typed.sales_order_id,
        organizationName: resolveOrganizationName(typed.organizations),
        orderStatus: resolveEffectiveInboundOrderStatus({
          handoffStatus: typed.status,
          orderStatus,
        }),
        orderTimeline: resolveOrderTimeline(typed.sales_orders),
        purchaseOrderRequirement:
          purchaseOrderRequirementBySalesOrderId.get(typed.sales_order_id) ??
          null,
      };
    })
    .filter((item) => {
      if (inboundSeenSalesOrderIds.has(item.salesOrderId)) {
        return false;
      }

      inboundSeenSalesOrderIds.add(item.salesOrderId);
      return true;
    });

  const activeInboundWorkOrders = inboundWorkOrders.filter((item) =>
    ["pending", "accepted", "in_progress"].includes(item.status),
  );
  const isLogisticsPartner =
    (servicePartner?.package_stream ?? "")
      .toLowerCase()
      .includes("logistics") || inboundWorkOrders.length > 0;

  return NextResponse.json({
    partner: {
      id: servicePartner?.id ?? servicePartnerId,
      name: servicePartner?.name ?? null,
      offeredServiceStream: servicePartner?.package_stream ?? null,
      isLogistics: isLogisticsPartner,
    },
    requests,
    summary,
    purchaseOrders: {
      total: purchaseOrdersWithRequirementEvidence.length,
      active: activePurchaseOrders.length,
      pendingAction: pendingPurchaseOrders.length,
      recent: activePurchaseOrders.slice(0, 1),
      additionalRecent: activePurchaseOrders.slice(1, 6),
    },
    logisticsWorkOrders: {
      total: inboundWorkOrders.length,
      pendingAcceptance: inboundWorkOrders.filter(
        (item) => item.status === "pending",
      ).length,
      accepted: inboundWorkOrders.filter((item) => item.status === "accepted")
        .length,
      inProgress: inboundWorkOrders.filter(
        (item) => item.status === "in_progress",
      ).length,
      completed: inboundWorkOrders.filter((item) => item.status === "completed")
        .length,
      rejected: inboundWorkOrders.filter((item) => item.status === "rejected")
        .length,
      recent: activeInboundWorkOrders.slice(0, 1),
      additionalRecent: activeInboundWorkOrders.slice(1, 6),
      all: inboundWorkOrders,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requirePartnerContext();
  if ("error" in auth) {
    return auth.error;
  }

  const { admin, servicePartnerId, partnerUserId } = auth;
  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : null;
  const action = typeof body?.action === "string" ? body.action : null;

  if (!requestId || (action !== "accept" && action !== "reject")) {
    return NextResponse.json(
      { error: "requestId and action (accept|reject) are required." },
      { status: 400 },
    );
  }

  const { data: requestRow, error: requestError } = await admin
    .from("customer_provider_requests")
    .select(
      "id, provider_id, organization_id, package_stream, request_status, metadata",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (
    requestError ||
    !requestRow ||
    requestRow.provider_id !== servicePartnerId
  ) {
    return NextResponse.json(
      { error: "Partner request not found." },
      { status: 404 },
    );
  }

  const normalizedAction = action as PartnerDecisionAction;
  const nowIso = new Date().toISOString();
  const existingMetadata =
    typeof requestRow.metadata === "object" && requestRow.metadata !== null
      ? (requestRow.metadata as Record<string, unknown>)
      : {};

  const updatePayload =
    normalizedAction === "accept"
      ? {
          request_status: "acknowledged",
          acknowledged_at: nowIso,
          metadata: {
            ...existingMetadata,
            partner_decision: "accepted",
            partner_decision_at: nowIso,
          },
        }
      : {
          request_status: "failed",
          metadata: {
            ...existingMetadata,
            partner_decision: "rejected",
            partner_decision_at: nowIso,
          },
        };

  const { error: updateError } = await admin
    .from("customer_provider_requests")
    .update(updatePayload)
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const partnerName =
    typeof existingMetadata.provider_name === "string" &&
    existingMetadata.provider_name.length > 0
      ? existingMetadata.provider_name
      : "Your assigned partner";

  const partnerDecisionMessage =
    normalizedAction === "accept"
      ? `${partnerName} accepted your onboarding request for ${requestRow.package_stream}. They can now start work once required submissions are complete.`
      : `${partnerName} declined your onboarding request for ${requestRow.package_stream}. Please review your submission details and contact support for next steps.`;

  const { data: customerProfiles } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("organization_id", requestRow.organization_id)
    .eq("role", "customer");

  const customerUserIds = Array.from(
    new Set((customerProfiles ?? []).map((row) => row.user_id).filter(Boolean)),
  );

  if (customerUserIds.length > 0) {
    await admin.from("notifications").insert(
      customerUserIds.map((userId) => ({
        user_id: userId,
        organization_id: requestRow.organization_id,
        message: partnerDecisionMessage,
        metadata: {
          source: "partner_dashboard_decision",
          provider_request_id: requestId,
          package_stream: requestRow.package_stream,
          decision: normalizedAction,
        },
      })),
    );
  }

  const { data: relatedServiceRequests } = await admin
    .from("service_requests")
    .select("id")
    .eq("provider_request_id", requestId);

  if ((relatedServiceRequests ?? []).length > 0) {
    await admin.from("request_messages").insert(
      relatedServiceRequests!.map((serviceRequest) => ({
        request_id: serviceRequest.id,
        sender_id: partnerUserId,
        body: partnerDecisionMessage,
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    requestId,
    requestStatus: normalizedAction === "accept" ? "acknowledged" : "failed",
  });
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

type RawRequirementRow = {
  id: string;
  organization_id: string;
  package_stream: string;
  provider_id: string | null;
  title: string;
  evidence_type: string;
  status: string;
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

  return { admin, servicePartnerId, partnerUserId: user.id };
}

function resolveOrganizationName(value: RawRequestRow["organizations"]) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }

  return value.name ?? null;
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
    .select("id, name, package_stream")
    .eq("id", servicePartnerId)
    .maybeSingle();

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
        "id, organization_id, package_stream, provider_id, title, evidence_type, status, is_required, updated_at",
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

  return NextResponse.json({
    partner: {
      id: servicePartner?.id ?? servicePartnerId,
      name: servicePartner?.name ?? null,
      offeredServiceStream: servicePartner?.package_stream ?? null,
    },
    requests,
    summary,
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

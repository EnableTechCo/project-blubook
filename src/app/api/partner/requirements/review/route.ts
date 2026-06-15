import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";

type ReviewAction = "approve" | "request_resubmission";

function isReviewAction(value: unknown): value is ReviewAction {
  return value === "approve" || value === "request_resubmission";
}

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

function readPreferredSalesPartnerEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const candidate = (metadata as { preferred_sales_partner_email?: unknown })
    .preferred_sales_partner_email;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

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
    .select("role, metadata, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const servicePartnerId = await resolveServicePartnerIdForPartnerUser({
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
  const requirementItemId =
    typeof body?.requirementItemId === "string" ? body.requirementItemId : null;
  const action = body?.action;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!requirementItemId || !isReviewAction(action)) {
    return NextResponse.json(
      { error: "requirementItemId and valid action are required." },
      { status: 400 },
    );
  }

  if (action === "request_resubmission" && reason.length < 6) {
    return NextResponse.json(
      {
        error:
          "Please provide a clear reason (at least 6 characters) for resubmission.",
      },
      { status: 400 },
    );
  }

  const { data: requirementItem, error: requirementError } = await admin
    .from("customer_requirement_items")
    .select(
      "id, organization_id, package_stream, provider_id, status, metadata",
    )
    .eq("id", requirementItemId)
    .maybeSingle();

  if (requirementError || !requirementItem) {
    return NextResponse.json(
      { error: "Requirement item not found." },
      { status: 404 },
    );
  }

  const directProviderMatch = requirementItem.provider_id === servicePartnerId;

  let canReview = directProviderMatch;

  if (!canReview) {
    const { data: servicePartner } = await admin
      .from("service_partners")
      .select("id, metadata")
      .eq("id", servicePartnerId)
      .maybeSingle();

    const partnerEmailCandidates = [
      readPartnerEmail(servicePartner?.metadata),
      user.email ?? null,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    const salesOrderId = readSalesOrderIdFromRequirementMetadata(
      requirementItem.metadata,
    );

    if (salesOrderId && partnerEmailCandidates.length > 0) {
      const { data: salesOrder } = await admin
        .from("sales_orders")
        .select("id, metadata")
        .eq("id", salesOrderId)
        .maybeSingle();

      const preferredSalesPartnerEmail = readPreferredSalesPartnerEmail(
        salesOrder?.metadata,
      )?.toLowerCase();

      if (
        preferredSalesPartnerEmail &&
        partnerEmailCandidates.includes(preferredSalesPartnerEmail)
      ) {
        canReview = true;
      }
    }
  }

  if (!canReview) {
    const { data: mappedRequest } = await admin
      .from("customer_provider_requests")
      .select("id")
      .eq("organization_id", requirementItem.organization_id)
      .eq("package_stream", requirementItem.package_stream)
      .eq("provider_id", servicePartnerId)
      .in("request_status", ["sent", "acknowledged"])
      .limit(1)
      .maybeSingle();

    canReview = Boolean(mappedRequest?.id);
  }

  if (!canReview) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const nextStatus = action === "approve" ? "approved" : "rejected";
  const nextReason =
    action === "approve" ? reason || "Approved by partner review." : reason;

  const { data: updatedRequirement, error: updateError } = await admin
    .from("customer_requirement_items")
    .update({
      status: nextStatus,
      status_reason: nextReason,
      approved_at: action === "approve" ? now : null,
      rejected_at: action === "request_resubmission" ? now : null,
      updated_at: now,
    })
    .eq("id", requirementItem.id)
    .select("id, status, status_reason, updated_at")
    .single();

  if (updateError || !updatedRequirement) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not update requirement status." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    requirementItem: updatedRequirement,
  });
}

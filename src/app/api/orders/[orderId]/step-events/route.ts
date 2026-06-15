import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";
import {
  getStepEventsForOrder,
  recordStepEvent,
  upsertStepInput,
} from "@/services/workflow-step-events.service";
import { buildAudienceStepView } from "@/services/workflow-step-events.service";
import type { WorkflowAudienceRole } from "@/lib/workflow/workflow-step-contract";

type ApiRole =
  | "customer"
  | "partner"
  | "staff"
  | "admin"
  | "sales"
  | "logistics";

type AccessContext = {
  userId: string;
  role: ApiRole;
  organizationId: string | null;
  servicePartnerId: string | null;
  profileMetadata: unknown;
  userMetadata: unknown;
  admin: ReturnType<typeof createAdminClient>;
};

function normalizeRole(value: unknown): ApiRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "customer" ||
    normalized === "partner" ||
    normalized === "staff" ||
    normalized === "admin" ||
    normalized === "sales" ||
    normalized === "logistics"
  ) {
    return normalized;
  }

  return null;
}

function readServicePartnerId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as { service_partner_id?: unknown })
    .service_partner_id;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

function defaultAudienceForRole(role: ApiRole): WorkflowAudienceRole {
  if (role === "customer") return "customer";
  if (role === "sales") return "sales";
  if (role === "logistics" || role === "partner") return "logistics";
  return "staff";
}

function allowedAudiencesForRole(role: ApiRole): WorkflowAudienceRole[] {
  if (role === "admin" || role === "staff") {
    return ["customer", "sales", "logistics", "staff"];
  }

  return [defaultAudienceForRole(role)];
}

function actorTypeForRole(
  role: ApiRole,
): "staff" | "sales" | "logistics" | "customer" | "system" {
  if (role === "customer") return "customer";
  if (role === "sales") return "sales";
  if (role === "logistics" || role === "partner") return "logistics";
  return "staff";
}

async function resolveAccessContext() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, organization_id, metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  let organizationId =
    typeof profile?.organization_id === "string"
      ? profile.organization_id
      : null;

  if (!organizationId) {
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    organizationId = membership?.organization_id ?? null;
  }

  const role =
    normalizeRole(profile?.role) ??
    normalizeRole((user.user_metadata as { role?: unknown } | null)?.role) ??
    normalizeRole((user.app_metadata as { role?: unknown } | null)?.role);

  if (!role) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    context: {
      userId: user.id,
      role,
      organizationId,
      servicePartnerId:
        readServicePartnerId(profile?.metadata) ??
        readServicePartnerId(user.user_metadata),
      profileMetadata: profile?.metadata ?? null,
      userMetadata: user.user_metadata,
      admin,
    } satisfies AccessContext,
  };
}

async function resolvePartnerId(context: AccessContext) {
  if (context.servicePartnerId) {
    return context.servicePartnerId;
  }

  return resolveServicePartnerIdForPartnerUser({
    admin: context.admin,
    userId: context.userId,
    profileMetadata: context.profileMetadata,
    profileOrganizationId: context.organizationId,
    userMetadata: context.userMetadata,
  });
}

async function verifyOrderAccess(context: AccessContext, orderId: string) {
  const { data: order, error: orderError } = await context.admin
    .from("sales_orders")
    .select("id, organization_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const sameOrganization =
    Boolean(context.organizationId) &&
    context.organizationId === order.organization_id;

  if (context.role === "partner") {
    if (sameOrganization) {
      return null;
    }

    const partnerId = await resolvePartnerId(context);
    if (!partnerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: handoff } = await context.admin
      .from("provider_workflow_handoffs")
      .select("id")
      .eq("sales_order_id", orderId)
      .or(`from_provider_id.eq.${partnerId},to_provider_id.eq.${partnerId}`)
      .limit(1)
      .maybeSingle();

    if (!handoff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return null;
  }

  if (!sameOrganization) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/**
 * GET /api/orders/[orderId]/step-events
 *
 * Returns the audience-filtered step view for the order.
 * Query param: ?audience=customer|sales|logistics|staff
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const url = new URL(_req.url);
  const resolved = await resolveAccessContext();
  if ("error" in resolved) {
    return resolved.error;
  }

  const accessError = await verifyOrderAccess(resolved.context, orderId);
  if (accessError) {
    return accessError;
  }

  const rawAudience =
    url.searchParams.get("audience") ??
    defaultAudienceForRole(resolved.context.role);

  const VALID_AUDIENCES: WorkflowAudienceRole[] = [
    "customer",
    "sales",
    "logistics",
    "staff",
  ];

  if (!VALID_AUDIENCES.includes(rawAudience as WorkflowAudienceRole)) {
    return NextResponse.json(
      { error: `Invalid audience "${rawAudience}".` },
      { status: 400 },
    );
  }

  const audience = rawAudience as WorkflowAudienceRole;

  const allowedAudiences = allowedAudiencesForRole(resolved.context.role);
  if (!allowedAudiences.includes(audience)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const events = await getStepEventsForOrder(orderId);
    const completedStepKeys = events.map((e) => e.step_key);

    const steps = buildAudienceStepView({ audience, completedStepKeys });

    return NextResponse.json({
      orderId,
      audience,
      completedStepKeys,
      steps,
      events,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/orders/[orderId]/step-events
 *
 * Record a completed workflow step event for an order.
 *
 * Body:
 * {
 *   stepKey: string;           // must match WORKFLOW_STEP_CONTRACT key
 *   source: string;            // action identifier, e.g. 'sales/advance:validate'
 *   proofUrl?: string | null;
 *   proofType?: string | null;
 *   metadata?: Record<string, unknown>;
 *   inputData?: Record<string, unknown>;  // optional step input fields; validated against contract
 *   actorNotes?: string | null;
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const resolved = await resolveAccessContext();
  if ("error" in resolved) {
    return resolved.error;
  }

  const accessError = await verifyOrderAccess(resolved.context, orderId);
  if (accessError) {
    return accessError;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    stepKey,
    source,
    proofUrl,
    proofType,
    metadata,
    inputData,
    actorNotes,
  } = body as Record<string, unknown>;

  if (!stepKey || typeof stepKey !== "string") {
    return NextResponse.json(
      { error: "stepKey is required." },
      { status: 400 },
    );
  }

  if (!source || typeof source !== "string") {
    return NextResponse.json({ error: "source is required." }, { status: 400 });
  }

  try {
    const event = await recordStepEvent({
      orderId,
      stepKey,
      actorType: actorTypeForRole(resolved.context.role),
      actorId: resolved.context.userId,
      source,
      proofUrl: typeof proofUrl === "string" ? proofUrl : null,
      proofType: typeof proofType === "string" ? proofType : null,
      metadata:
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>)
          : {},
    });

    let input = null;
    if (
      inputData &&
      typeof inputData === "object" &&
      !Array.isArray(inputData)
    ) {
      try {
        input = await upsertStepInput({
          orderId,
          stepKey,
          inputData: inputData as Record<string, unknown>,
          actorNotes: typeof actorNotes === "string" ? actorNotes : null,
        });
      } catch (inputErr) {
        const inputMsg =
          inputErr instanceof Error ? inputErr.message : "Unknown error";
        return NextResponse.json(
          { error: `Step recorded but input data failed: ${inputMsg}`, event },
          { status: 207 },
        );
      }
    }

    return NextResponse.json({ event, input }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // 409 for duplicate step (already recorded)
    const status = message.includes("already been recorded") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

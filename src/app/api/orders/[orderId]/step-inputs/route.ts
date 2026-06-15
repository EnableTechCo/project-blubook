import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";
import {
  getAllStepInputsForOrder,
  getStepInput,
  upsertStepInput,
} from "@/services/workflow-step-events.service";

type ApiRole =
  | "customer"
  | "partner"
  | "staff"
  | "admin"
  | "sales"
  | "logistics";

function normalizeRole(value: unknown): ApiRole | null {
  if (typeof value !== "string") return null;
  const n = value.trim().toLowerCase();
  if (
    n === "customer" ||
    n === "partner" ||
    n === "staff" ||
    n === "admin" ||
    n === "sales" ||
    n === "logistics"
  ) {
    return n;
  }
  return null;
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

async function resolveContext(orderId: string) {
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

  // Verify order exists and caller can access it
  const { data: order, error: orderError } = await admin
    .from("sales_orders")
    .select("id, organization_id, metadata")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return {
      error: NextResponse.json({ error: "Order not found." }, { status: 404 }),
    };
  }

  const sameOrg =
    Boolean(organizationId) && organizationId === order.organization_id;

  if (role === "partner") {
    const servicePartnerId = await resolveServicePartnerIdForPartnerUser({
      admin,
      userId: user.id,
      profileMetadata: profile?.metadata ?? null,
      profileOrganizationId: profile?.organization_id ?? null,
      userMetadata: user.user_metadata,
    });

    const { data: servicePartner } = servicePartnerId
      ? await admin
          .from("service_partners")
          .select("id, metadata")
          .eq("id", servicePartnerId)
          .maybeSingle()
      : { data: null };

    const servicePartnerEmail = readPartnerEmail(servicePartner?.metadata);
    const preferredSalesPartnerEmail = readPreferredSalesPartnerEmail(
      order.metadata,
    );

    const hasDirectOrderAssignment =
      Boolean(servicePartnerEmail) &&
      Boolean(preferredSalesPartnerEmail) &&
      servicePartnerEmail?.toLowerCase() ===
        preferredSalesPartnerEmail?.toLowerCase();

    const { data: handoff } = servicePartnerId
      ? await admin
          .from("provider_workflow_handoffs")
          .select("id")
          .eq("sales_order_id", orderId)
          .or(
            `from_provider_id.eq.${servicePartnerId},to_provider_id.eq.${servicePartnerId}`,
          )
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (!sameOrg && !handoff && !hasDirectOrderAssignment) {
      return {
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  } else if (!sameOrg) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId: user.id, role, admin };
}

/**
 * GET /api/orders/[orderId]/step-inputs
 *
 * Returns all recorded step inputs for the order, keyed by step_key.
 * Query param: ?stepKey=<key>  (optional, returns just that step)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const resolved = await resolveContext(orderId);
  if ("error" in resolved) return resolved.error;

  const url = new URL(req.url);
  const stepKey = url.searchParams.get("stepKey");

  try {
    if (stepKey) {
      const input = await getStepInput(orderId, stepKey);
      return NextResponse.json({ orderId, stepKey, input });
    }

    const inputs = await getAllStepInputsForOrder(orderId);
    return NextResponse.json({ orderId, inputs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/orders/[orderId]/step-inputs
 *
 * Upsert structured input data for a workflow step.
 *
 * Body:
 * {
 *   stepKey: string;
 *   inputData: Record<string, unknown>;
 *   actorNotes?: string | null;
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const resolved = await resolveContext(orderId);
  if ("error" in resolved) return resolved.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { stepKey, inputData, actorNotes } = body as Record<string, unknown>;

  if (!stepKey || typeof stepKey !== "string") {
    return NextResponse.json(
      { error: "stepKey is required." },
      { status: 400 },
    );
  }

  if (!inputData || typeof inputData !== "object" || Array.isArray(inputData)) {
    return NextResponse.json(
      { error: "inputData must be a non-null object." },
      { status: 400 },
    );
  }

  try {
    const row = await upsertStepInput({
      orderId,
      stepKey,
      inputData: inputData as Record<string, unknown>,
      actorNotes: typeof actorNotes === "string" ? actorNotes : null,
    });

    return NextResponse.json({ input: row }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Missing required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

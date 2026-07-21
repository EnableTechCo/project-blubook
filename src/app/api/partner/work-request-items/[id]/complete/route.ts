import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";
import { completeWorkOrderItem } from "@/services/work-order-completion.service";

// A provider marks one assigned work order complete (Phase 3, P3-4).
//
// Completing an item advances its request: anything whose prerequisites are
// now satisfied is released and dispatched, and the parent closes when the
// last item finishes.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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
      .select("metadata, organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const servicePartnerId = await resolveServicePartnerIdForPartnerUser({
      admin,
      userId: user.id,
      profileMetadata: profile?.metadata,
      profileOrganizationId: profile?.organization_id ?? null,
      userMetadata: user.user_metadata,
    });

    if (!servicePartnerId) {
      return NextResponse.json(
        { error: "You are not linked to a service provider." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const result = await completeWorkOrderItem(admin, {
      workRequestItemId: id,
      expectedProviderId: servicePartnerId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      workRequestId: result.workRequestId,
      queuedForRetry: result.queuedForRetry,
      released: result.advance?.releasedItemIds.length ?? 0,
      dispatched: result.advance?.dispatchedCount ?? 0,
      requestCompleted: result.advance?.requestCompleted ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete the work order.",
      },
      { status: 500 },
    );
  }
}

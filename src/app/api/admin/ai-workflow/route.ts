import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdminOrStaff() {
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
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

export async function GET() {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const { admin } = auth;

    const [
      { count: queuedEvents, error: queuedError },
      { count: processingEvents, error: processingError },
      { count: failedEvents, error: failedError },
      { count: pendingProviderHandoffs, error: pendingProviderError },
      { count: inProgressProviderHandoffs, error: inProgressProviderError },
      { count: logisticsInTransit, error: logisticsTransitError },
      { count: logisticsReroute, error: logisticsRerouteError },
    ] = await Promise.all([
      admin
        .from("workflow_events_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued"),
      admin
        .from("workflow_events_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "processing"),
      admin
        .from("workflow_events_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      admin
        .from("provider_workflow_handoffs")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("provider_workflow_handoffs")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
      admin
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "Track Shipment In Transit"),
      admin
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "Reroute Delivery"),
    ]);

    const firstError =
      queuedError ??
      processingError ??
      failedError ??
      pendingProviderError ??
      inProgressProviderError ??
      logisticsTransitError ??
      logisticsRerouteError;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    return NextResponse.json({
      readiness: {
        adminUiReady: true,
        notes: [
          "Backend endpoint is ready for Admin AI workflow dashboard integration.",
          "Partner assignment remains manual by policy; AI recommendation only.",
        ],
      },
      queue: {
        queued: queuedEvents ?? 0,
        processing: processingEvents ?? 0,
        failed: failedEvents ?? 0,
      },
      providerHandoffs: {
        pending: pendingProviderHandoffs ?? 0,
        inProgress: inProgressProviderHandoffs ?? 0,
      },
      logistics: {
        inTransit: logisticsInTransit ?? 0,
        rerouteCases: logisticsReroute ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load admin AI workflow overview.",
      },
      { status: 500 },
    );
  }
}

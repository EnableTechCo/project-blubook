import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        {
          error:
            profileError?.message ??
            "Customer profile is not linked to an organization.",
        },
        { status: 400 },
      );
    }

    const organizationId = profile.organization_id;

    const [
      { count: providerRequestTotal, error: providerRequestTotalError },
      { count: providerRequestSent, error: providerRequestSentError },
      { count: requiredTotal, error: requiredTotalError },
      { count: requiredSubmitted, error: requiredSubmittedError },
      { count: slaTotal, error: slaTotalError },
      { count: slaActive, error: slaActiveError },
      { count: generatedRequests, error: generatedRequestsError },
    ] = await Promise.all([
      admin
        .from("customer_provider_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      admin
        .from("customer_provider_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("request_status", "sent"),
      admin
        .from("customer_requirement_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_required", true),
      admin
        .from("customer_requirement_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_required", true)
        .in("status", ["submitted", "approved"]),
      admin
        .from("customer_sla_activations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      admin
        .from("customer_sla_activations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active"),
      admin
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .not("provider_request_id", "is", null),
    ]);

    const error =
      providerRequestTotalError ??
      providerRequestSentError ??
      requiredTotalError ??
      requiredSubmittedError ??
      slaTotalError ??
      slaActiveError ??
      generatedRequestsError;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const providerTotal = providerRequestTotal ?? 0;
    const providerSent = providerRequestSent ?? 0;
    const requiredCount = requiredTotal ?? 0;
    const submittedCount = requiredSubmitted ?? 0;
    const slaCount = slaTotal ?? 0;
    const slaActiveCount = slaActive ?? 0;

    return NextResponse.json({
      providerRequests: {
        total: providerTotal,
        sent: providerSent,
        allSent: providerTotal > 0 && providerTotal === providerSent,
      },
      customerRequirements: {
        required: requiredCount,
        submittedOrApproved: submittedCount,
        allSubmitted: requiredCount > 0 && requiredCount === submittedCount,
      },
      slas: {
        total: slaCount,
        active: slaActiveCount,
        allActive: slaCount > 0 && slaCount === slaActiveCount,
      },
      generatedCustomerRequests: generatedRequests ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not compute provider readiness.",
      },
      { status: 500 },
    );
  }
}

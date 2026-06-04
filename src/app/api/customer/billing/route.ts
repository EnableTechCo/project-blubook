import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const actionSchema = z.object({
  action: z.enum(["cancel", "upgrade"]),
  packageCode: z.enum(["bronze", "silver", "premium"]).optional(),
});

async function resolveCustomerContext() {
  const supabaseServer = await createServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return {
      error: NextResponse.json(
        { error: "Customer profile is not linked to an organization." },
        { status: 404 },
      ),
    };
  }

  return { admin, organizationId: profile.organization_id };
}

export async function GET() {
  const context = await resolveCustomerContext();
  if ("error" in context) {
    return context.error;
  }

  const { admin, organizationId } = context;

  const [{ data: subscriptions }, { data: invoices }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  const currentSubscription = subscriptions?.[0] ?? null;
  const packageIds = new Set<string>();

  if (currentSubscription?.package_id) {
    packageIds.add(currentSubscription.package_id);
  }

  const packageIdList = Array.from(packageIds);
  const { data: packages } = packageIdList.length
    ? await admin
        .from("service_packages")
        .select(
          "id, code, name, billing_interval, currency_code, unit_amount_cents, metadata",
        )
        .in("id", packageIdList)
    : { data: [] as Array<Record<string, unknown>> };

  const packageById = new Map((packages ?? []).map((pkg) => [pkg.id, pkg]));
  const activePackage = currentSubscription
    ? packageById.get(currentSubscription.package_id)
    : null;

  return NextResponse.json({
    currentSubscription: currentSubscription
      ? {
          id: currentSubscription.id,
          status: currentSubscription.status,
          cancelAtPeriodEnd: currentSubscription.cancel_at_period_end,
          currentPeriodStart: currentSubscription.current_period_start,
          currentPeriodEnd: currentSubscription.current_period_end,
          package: activePackage
            ? {
                id: activePackage.id,
                code: activePackage.code,
                name: activePackage.name,
                billingInterval: activePackage.billing_interval,
                currencyCode: activePackage.currency_code,
                unitAmountCents: activePackage.unit_amount_cents,
                metadata: activePackage.metadata,
              }
            : null,
        }
      : null,
    invoices:
      invoices?.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        currencyCode: invoice.currency_code,
        totalCents: invoice.total_cents,
        issuedAt: invoice.issued_at,
        dueAt: invoice.due_at,
        paidAt: invoice.paid_at,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        pdfUrl: invoice.pdf_url,
      })) ?? [],
  });
}

export async function POST(request: Request) {
  const context = await resolveCustomerContext();
  if ("error" in context) {
    return context.error;
  }

  const { admin, organizationId } = context;

  try {
    const payload = actionSchema.parse(await request.json());
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (subscriptionError || !subscriptions?.length) {
      return NextResponse.json(
        { error: "No subscription found for this customer." },
        { status: 404 },
      );
    }

    const subscription = subscriptions[0];

    if (payload.action === "cancel") {
      const { error } = await admin
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    if (!payload.packageCode) {
      return NextResponse.json(
        { error: "packageCode is required for upgrade." },
        { status: 400 },
      );
    }

    const { data: selectedPackage, error: packageError } = await admin
      .from("service_packages")
      .select("id, billing_interval, currency_code, unit_amount_cents")
      .eq("code", payload.packageCode)
      .single();

    if (packageError || !selectedPackage) {
      return NextResponse.json(
        { error: packageError?.message ?? "Package not found." },
        { status: 404 },
      );
    }

    const { error } = await admin
      .from("subscriptions")
      .update({
        package_id: selectedPackage.id,
        billing_interval: selectedPackage.billing_interval,
        currency_code: selectedPackage.currency_code,
        unit_amount_cents: selectedPackage.unit_amount_cents,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update billing.",
      },
      { status: 500 },
    );
  }
}

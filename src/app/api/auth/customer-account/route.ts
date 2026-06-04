import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCustomerOnboardingServerEnv } from "@/lib/env";
import { dispatchQueuedEmails, queueEmail } from "@/lib/email/dispatcher";
import {
  persistCustomerOnboardingAutomation,
  type OnboardingAutomationSignals,
} from "@/features/ai/automations/onboarding-intelligence";

const customerAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  packageTier: z.string().min(1),
  onboarding: z.object({
    businessTitle: z.string().min(2),
    businessSummary: z.string().min(3),
    primaryIndustry: z.string().min(2),
    subIndustry: z.string().trim().nullable().optional(),
    businessModel: z.enum([
      "seller",
      "reseller",
      "distributor",
      "manufacturer",
      "marketplace",
      "service_provider",
    ]),
    customerSegment: z.enum(["b2b", "b2c", "hybrid"]),
    salesChannels: z
      .array(
        z.enum([
          "own_website",
          "marketplace",
          "retail",
          "wholesale",
          "social",
          "direct_sales",
        ]),
      )
      .min(1),
    inventoryModel: z.enum(["own_stock", "dropship", "hybrid", "none"]),
    fulfillmentModel: z.enum(["in_house", "third_party", "hybrid"]),
    annualRevenueBand: z.enum([
      "under_1m",
      "1m_10m",
      "10m_50m",
      "50m_200m",
      "200m_plus",
    ]),
    monthlyOrderVolumeBand: z.enum([
      "under_100",
      "100_1000",
      "1000_10000",
      "10000_plus",
    ]),
    companyType: z.enum(["llc", "corporation", "partnership"]),
    employees: z.enum(["1-20", "21-49", "50+"]),
    country: z.string().min(2),
    city: z.string().min(2),
    inventoryHandling: z.enum(["in_house", "third_party", "none"]),
    regions: z.array(z.enum(["domestic", "cross_border"])).min(1),
    regulated: z.boolean(),
  }),
});

function addPeriodEnd(
  start: Date,
  interval: "monthly" | "quarterly" | "annual" | "one_time",
) {
  const date = new Date(start);

  if (interval === "monthly") {
    date.setMonth(date.getMonth() + 1);
    return date;
  }

  if (interval === "quarterly") {
    date.setMonth(date.getMonth() + 3);
    return date;
  }

  if (interval === "annual") {
    date.setFullYear(date.getFullYear() + 1);
    return date;
  }

  date.setDate(date.getDate() + 1);
  return date;
}

function buildInvoiceNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${stamp}-${suffix}`;
}

function formatMoney(currencyCode: string, cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

  if (currencyCode.toUpperCase() === "ZAR") {
    return `R${amount}`;
  }

  return `${currencyCode.toUpperCase()} ${amount}`;
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    assertCustomerOnboardingServerEnv();
    const body = customerAccountSchema.parse(await request.json());

    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
        name: body.fullName,
        role: "customer",
        package_tier: body.packageTier,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user?.id) {
      return NextResponse.json(
        { error: "User account could not be created." },
        { status: 400 },
      );
    }

    createdUserId = data.user.id;

    const { data: selectedPackage, error: packageError } = await supabase
      .from("service_packages")
      .select(
        "id, code, name, billing_interval, currency_code, unit_amount_cents",
      )
      .eq("code", body.packageTier)
      .single();

    if (packageError || !selectedPackage) {
      throw new Error(packageError?.message ?? "Selected package not found.");
    }

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        kind: "customer",
        name: body.onboarding.businessTitle,
        primary_contact_name: body.fullName,
        primary_contact_email: body.email,
      })
      .select("id")
      .single();

    if (organizationError || !organization) {
      throw new Error(
        organizationError?.message ?? "Could not create customer organization.",
      );
    }

    const nowIso = new Date().toISOString();

    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        user_id: createdUserId,
        organization_id: organization.id,
        full_name: body.fullName,
        email: body.email,
        role: "customer",
        membership_status: "active",
        invited_at: nowIso,
        activated_at: nowIso,
      });

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .insert({
        organization_id: organization.id,
        user_id: createdUserId,
        email: body.email,
        role: "customer",
        status: "active",
        is_primary: true,
        invited_by: createdUserId,
        invited_at: nowIso,
        accepted_at: nowIso,
      })
      .select("id")
      .single();

    if (membershipError || !membership) {
      throw new Error(
        membershipError?.message ?? "Could not create customer membership.",
      );
    }

    const { data: onboardingSubmission, error: onboardingError } =
      await supabase
        .from("customer_onboarding_submissions")
        .insert({
          organization_id: organization.id,
          contact_name: body.fullName,
          contact_email: body.email,
          package_id: selectedPackage.id,
          submission_status: "submitted",
          business_title: body.onboarding.businessTitle,
          business_summary: body.onboarding.businessSummary,
          primary_industry: body.onboarding.primaryIndustry,
          sub_industry: body.onboarding.subIndustry,
          business_model: body.onboarding.businessModel,
          customer_segment: body.onboarding.customerSegment,
          sales_channels: body.onboarding.salesChannels,
          inventory_model: body.onboarding.inventoryModel,
          fulfillment_model: body.onboarding.fulfillmentModel,
          annual_revenue_band: body.onboarding.annualRevenueBand,
          monthly_order_volume_band: body.onboarding.monthlyOrderVolumeBand,
          company_type: body.onboarding.companyType,
          employees: body.onboarding.employees,
          country: body.onboarding.country,
          city: body.onboarding.city,
          inventory_handling: body.onboarding.inventoryHandling,
          regulated: body.onboarding.regulated,
          regions: body.onboarding.regions,
          payload: body.onboarding,
        })
        .select("id")
        .single();

    if (onboardingError || !onboardingSubmission) {
      throw new Error(
        onboardingError?.message ?? "Could not save onboarding submission.",
      );
    }

    await persistCustomerOnboardingAutomation({
      supabase,
      organizationId: organization.id,
      onboardingSubmissionId: onboardingSubmission.id,
      packageTier: body.packageTier,
      country: body.onboarding.country,
      city: body.onboarding.city,
      onboarding: body.onboarding as OnboardingAutomationSignals,
      createdBy: createdUserId,
    });

    const periodStart = new Date();
    const periodEnd = addPeriodEnd(
      periodStart,
      selectedPackage.billing_interval as
        | "monthly"
        | "quarterly"
        | "annual"
        | "one_time",
    );

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert({
        organization_id: organization.id,
        package_id: selectedPackage.id,
        onboarding_submission_id: onboardingSubmission.id,
        status: "active",
        billing_interval: selectedPackage.billing_interval,
        currency_code: selectedPackage.currency_code,
        unit_amount_cents: selectedPackage.unit_amount_cents,
        quantity: 1,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select("id")
      .single();

    if (subscriptionError || !subscription) {
      throw new Error(
        subscriptionError?.message ?? "Could not create subscription.",
      );
    }

    const invoiceNumber = buildInvoiceNumber();

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        organization_id: organization.id,
        subscription_id: subscription.id,
        onboarding_submission_id: onboardingSubmission.id,
        invoice_number: invoiceNumber,
        status: "issued",
        currency_code: selectedPackage.currency_code,
        subtotal_cents: selectedPackage.unit_amount_cents,
        tax_cents: 0,
        total_cents: selectedPackage.unit_amount_cents,
        due_at: periodStart.toISOString(),
        issued_at: nowIso,
        billing_reason: "package_purchase",
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      throw new Error(invoiceError?.message ?? "Could not create invoice.");
    }

    const { error: lineItemError } = await supabase
      .from("invoice_line_items")
      .insert({
        invoice_id: invoice.id,
        package_id: selectedPackage.id,
        description: `${selectedPackage.name} subscription`,
        quantity: 1,
        unit_amount_cents: selectedPackage.unit_amount_cents,
        line_total_cents: selectedPackage.unit_amount_cents,
      });

    if (lineItemError) {
      throw new Error(lineItemError.message);
    }

    const { error: requirementsSyncError } = await supabase.rpc(
      "sync_customer_requirements",
      {
        p_organization_id: organization.id,
      },
    );

    if (requirementsSyncError) {
      throw new Error(requirementsSyncError.message);
    }

    const { error: providerSyncError } = await supabase.rpc(
      "sync_customer_provider_requests",
      {
        p_organization_id: organization.id,
        p_customer_user_id: createdUserId,
      },
    );

    if (providerSyncError) {
      throw new Error(providerSyncError.message);
    }

    const { error: slaRefreshError } = await supabase.rpc(
      "refresh_customer_sla_activation",
      {
        p_organization_id: organization.id,
      },
    );

    if (slaRefreshError) {
      throw new Error(slaRefreshError.message);
    }

    const assetBaseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
    ).replace(/\/$/, "");

    await queueEmail({
      templateKey: "customer-onboarding-complete",
      toEmail: body.email,
      organizationId: organization.id,
      invoiceId: invoice.id,
      subjectFallback: `Welcome to BluBook, ${body.fullName}`,
      payload: {
        asset_base_url: assetBaseUrl,
        customer_name: body.fullName,
        package_name: selectedPackage.name,
        invoice_number: invoiceNumber,
        membership_id: membership.id,
        total_cents: selectedPackage.unit_amount_cents,
        currency_code: selectedPackage.currency_code,
        total_amount: formatMoney(
          selectedPackage.currency_code,
          selectedPackage.unit_amount_cents,
        ),
        issued_date: periodStart.toLocaleDateString("en-ZA"),
        due_date: periodStart.toLocaleDateString("en-ZA"),
      },
    });

    await dispatchQueuedEmails(5);

    return NextResponse.json({
      userId: data.user.id,
      email: data.user?.email ?? body.email,
      organizationId: organization.id,
      subscriptionId: subscription.id,
      invoiceNumber,
    });
  } catch (error) {
    if (createdUserId) {
      const supabase = createAdminClient();
      await supabase.auth.admin.deleteUser(createdUserId);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create customer account.",
      },
      { status: 500 },
    );
  }
}

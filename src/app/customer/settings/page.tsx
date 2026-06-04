"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useCustomerContext } from "@/hooks/use-customer-context";

export default function CustomerSettingsPage() {
  const customerContext = useCustomerContext();
  const billingQuery = useQuery({
    queryKey: ["customer-billing-summary"],
    queryFn: async () => {
      const response = await fetch("/api/customer/billing");

      if (!response.ok) {
        throw new Error("Could not load billing summary.");
      }

      return (await response.json()) as {
        currentSubscription: {
          status: string;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: string | null;
          package: {
            name: string;
            metadata?: { display_price?: string };
          } | null;
        } | null;
        invoices: Array<{
          invoiceNumber: string;
          status: string;
          issuedAt: string | null;
        }>;
      };
    },
  });

  if (customerContext.isLoading || billingQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading settings...</p>;
  }

  if (
    customerContext.isError ||
    !customerContext.data ||
    billingQuery.isError
  ) {
    return (
      <p className="text-sm text-red-300">
        Could not load customer settings right now.
      </p>
    );
  }

  const currentSubscription = billingQuery.data?.currentSubscription ?? null;
  const latestInvoice = billingQuery.data?.invoices?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Customer Settings
          </p>
          <h2 className="text-3xl font-semibold text-white">
            Account Settings
          </h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Real account, organization, and billing metadata for this customer.
          </p>
        </div>
        <Badge>{customerContext.data.role}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Customer" description="Signed-in profile">
          <p className="text-lg font-semibold text-white">
            {customerContext.data.fullName ?? customerContext.data.email}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {customerContext.data.email}
          </p>
        </Card>
        <Card title="Organization" description="Current tenant scope">
          <p className="text-lg font-semibold text-white">
            {customerContext.data.organizationName ?? "Unnamed organization"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            ID: {customerContext.data.organizationId}
          </p>
        </Card>
        <Card title="Subscription" description="Current package state">
          <p className="text-lg font-semibold text-white">
            {currentSubscription?.package?.name ?? "No active package"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Status: {currentSubscription?.status ?? "none"}
          </p>
          {currentSubscription?.package?.metadata?.display_price ? (
            <p className="mt-1 text-sm text-slate-300">
              {currentSubscription.package.metadata.display_price}
            </p>
          ) : null}
        </Card>
        <Card title="Latest Invoice" description="Most recent billing record">
          <p className="text-lg font-semibold text-white">
            {latestInvoice?.invoiceNumber ?? "No invoice yet"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Status: {latestInvoice?.status ?? "none"}
          </p>
          {latestInvoice?.issuedAt ? (
            <p className="mt-1 text-sm text-slate-300">
              Issued: {new Date(latestInvoice.issuedAt).toLocaleDateString()}
            </p>
          ) : null}
        </Card>
      </div>

      <Card
        title="Lifecycle Flags"
        description="Customer account state pulled from live records."
      >
        <div className="flex flex-wrap gap-2 text-sm text-slate-200">
          <Badge>
            Cancel at period end:{" "}
            {currentSubscription?.cancelAtPeriodEnd ? "Yes" : "No"}
          </Badge>
          <Badge>
            Period end:{" "}
            {currentSubscription?.currentPeriodEnd
              ? new Date(
                  currentSubscription.currentPeriodEnd,
                ).toLocaleDateString()
              : "Not set"}
          </Badge>
        </div>
      </Card>
    </div>
  );
}

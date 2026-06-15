"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type BillingResponse = {
  currentSubscription: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    package: {
      id: string;
      code: "bronze" | "silver" | "premium";
      name: string;
      billingInterval: string;
      currencyCode: string;
      unitAmountCents: number;
      metadata?: { display_price?: string };
    } | null;
  } | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    currencyCode: string;
    totalCents: number;
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
    hostedInvoiceUrl: string | null;
    pdfUrl: string | null;
  }>;
};

function formatMoney(cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

  return `R${amount}`;
}

export default function CustomerBillingPage() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async (options?: { preserveView?: boolean }) => {
    if (!options?.preserveView) {
      setLoading(true);
    }
    const response = await fetch("/api/customer/billing");

    if (!response.ok) {
      setStatus("Could not load billing right now.");
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as BillingResponse;
    setData(payload);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const availableUpgrade = useMemo(() => {
    const code = data?.currentSubscription?.package?.code;
    if (code === "bronze") {
      return "silver" as const;
    }
    if (code === "silver") {
      return "premium" as const;
    }
    return null;
  }, [data?.currentSubscription?.package?.code]);

  const runAction = async (
    action: "cancel" | "upgrade",
    packageCode?: "bronze" | "silver" | "premium",
  ) => {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/customer/billing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, packageCode }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "Billing update failed.");
      setBusy(false);
      return;
    }

    setStatus(
      action === "cancel"
        ? "Subscription will cancel at period end."
        : "Subscription updated successfully.",
    );
    await refresh({ preserveView: true });
    setBusy(false);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-semibold text-slate-900 dark:text-white">
            Billing
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Track your active package, invoice history, and subscription
            actions.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Loading billing data...
        </p>
      ) : null}

      {!loading && data?.currentSubscription ? (
        <section className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-5 dark:border-white/15 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Current subscription
          </h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <p>
              Package:{" "}
              {data.currentSubscription.package?.name ?? "Unknown package"}
            </p>
            <p>
              Price:{" "}
              {data.currentSubscription.package?.metadata?.display_price ??
                (data.currentSubscription.package
                  ? formatMoney(
                      data.currentSubscription.package.unitAmountCents,
                    )
                  : "Unknown")}
            </p>
            <p>Status: {data.currentSubscription.status}</p>
            <p>
              Period end:{" "}
              {data.currentSubscription.currentPeriodEnd
                ? new Date(
                    data.currentSubscription.currentPeriodEnd,
                  ).toLocaleDateString()
                : "Not set"}
            </p>
            <p>
              Cancel at period end:{" "}
              {data.currentSubscription.cancelAtPeriodEnd ? "Yes" : "No"}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              disabled={busy || data.currentSubscription.cancelAtPeriodEnd}
              onClick={() => void runAction("cancel")}
            >
              Cancel subscription
            </Button>

            {availableUpgrade ? (
              <Button
                disabled={busy}
                onClick={() => void runAction("upgrade", availableUpgrade)}
              >
                Upgrade to{" "}
                {availableUpgrade[0].toUpperCase() + availableUpgrade.slice(1)}
              </Button>
            ) : (
              <Button disabled variant="ghost">
                Highest package active
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {!loading && !data?.currentSubscription ? (
        <section className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-5 dark:border-white/15 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            No active subscription
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Complete onboarding to activate billing and invoice tracking.
          </p>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-5 dark:border-white/15 dark:bg-white/5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Invoices
        </h3>

        {data?.invoices?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
              <thead>
                <tr className="text-slate-600 dark:text-slate-300">
                  <th className="px-2 py-2">Invoice</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Issued</th>
                  <th className="px-2 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-t border-slate-300 dark:border-white/10"
                  >
                    <td className="px-2 py-2 font-medium text-slate-900 dark:text-white">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-2 py-2">{invoice.status}</td>
                    <td className="px-2 py-2">
                      {formatMoney(invoice.totalCents)}
                    </td>
                    <td className="px-2 py-2">
                      {invoice.issuedAt
                        ? new Date(invoice.issuedAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-2 py-2">
                      {invoice.dueAt
                        ? new Date(invoice.dueAt).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No invoices available yet.
          </p>
        )}
      </section>

      {status ? (
        <p className="mt-4 text-sm text-cyan-700 dark:text-cyan-200">
          {status}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProviderHandoff = {
  id: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "rejected";
  package_stream: string;
  notes: string | null;
  assigned_at: string;
  metadata: {
    source_provider_name?: string | null;
    target_provider_name?: string | null;
  } | null;
  sales_order_items: {
    product_name: string;
    sku: string;
    quantity: number;
    sales_orders: {
      po_reference: string | null;
      status: string;
    } | null;
  } | null;
};

function PartnerMessagesLoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="h-9 w-56 rounded bg-white/10" />
          <div className="h-4 w-80 max-w-[90vw] rounded bg-white/10" />
        </div>
        <div className="h-7 w-32 rounded-full bg-white/10" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`metric-skeleton-${index}`}
            className="surface rounded-2xl p-5 shadow-panel"
          >
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="mt-2 h-3 w-36 rounded bg-white/10" />
            <div className="mt-5 h-8 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div
            key={`section-skeleton-${sectionIndex}`}
            className="surface rounded-2xl p-5 shadow-panel"
          >
            <div className="h-5 w-44 rounded bg-white/10" />
            <div className="mt-2 h-3 w-64 rounded bg-white/10" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div
                  key={`row-skeleton-${sectionIndex}-${rowIndex}`}
                  className="rounded-xl border border-white/15 bg-white/5 p-3"
                >
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-3/5 rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PartnerMessagesClient() {
  const [handoffs, setHandoffs] = useState<ProviderHandoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/partner/work-orders", {
        method: "GET",
      });
      const body = (await response.json().catch(() => null)) as {
        inboundProviderHandoffs?: ProviderHandoff[];
        error?: string;
      } | null;

      if (!mounted) {
        return;
      }

      if (!response.ok) {
        setError(body?.error || "Could not load partner messages workspace.");
        setLoading(false);
        return;
      }

      setHandoffs(body?.inboundProviderHandoffs ?? []);
      setLoading(false);
    }

    void fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const pending = handoffs.filter((item) => item.status === "pending");
    const active = handoffs.filter((item) =>
      ["accepted", "in_progress"].includes(item.status),
    );
    const completed = handoffs.filter((item) => item.status === "completed");

    const last24h = handoffs.filter((item) => {
      const assignedAt = new Date(item.assigned_at).getTime();
      return Date.now() - assignedAt <= 24 * 60 * 60 * 1000;
    });

    return { pending, active, completed, last24h };
  }, [handoffs]);

  if (loading) {
    return <PartnerMessagesLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-300">{error}</p>
        <Link href="/partner/work-orders" className="inline-flex">
          <Button variant="ghost">Go to work orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Partner Messages
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200/85">
            Message priorities update automatically from your assigned work
            orders.
          </p>
        </div>
        <Badge>{grouped.pending.length} Needs Response</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Needs Response" description="Pending decisions">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {grouped.pending.length}
          </p>
        </Card>
        <Card title="Active Threads" description="Accepted or in progress">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {grouped.active.length}
          </p>
        </Card>
        <Card title="Recent Updates" description="Assigned in last 24h">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {grouped.last24h.length}
          </p>
        </Card>
        <Card title="Completed" description="Closed work orders">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {grouped.completed.length}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Priority Conversations"
          description="Items that need a quick reply or decision"
        >
          {grouped.pending.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No pending provider handoffs right now.
            </p>
          ) : (
            <div className="space-y-3">
              {grouped.pending.slice(0, 6).map((item) => {
                const poRef =
                  item.sales_order_items?.sales_orders?.po_reference ||
                  "No PO reference";
                const product =
                  item.sales_order_items?.product_name ||
                  "Product not available";

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-amber-300/30 bg-amber-300/8 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      PO {poRef}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {product}
                    </p>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-100/90">
                      Needs initial response from the Logistics team.
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Active Conversation Streams"
          description="Live work being coordinated"
        >
          {grouped.active.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No active provider handoffs yet.
            </p>
          ) : (
            <div className="space-y-3">
              {grouped.active.slice(0, 6).map((item) => {
                const poRef =
                  item.sales_order_items?.sales_orders?.po_reference ||
                  "No PO reference";
                const statusLabel =
                  item.status === "in_progress" ? "In Progress" : "Accepted";

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-300/8 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        PO {poRef}
                      </p>
                      <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-700 dark:text-cyan-100">
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Service: {item.package_stream}
                    </p>
                    <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-100/90">
                      Last update: {new Date(item.assigned_at).toLocaleString()}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/partner/work-orders" className="inline-flex">
          <Button variant="ghost">Open Work Orders</Button>
        </Link>
      </div>
    </div>
  );
}

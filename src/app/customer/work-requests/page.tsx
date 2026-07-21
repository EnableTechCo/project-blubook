"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyStateNoticeCard } from "@/components/ui/empty-state-notice-card";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { InlineErrorMessage } from "@/components/ui/inline-error-message";
import {
  resolveDependencyClosure,
  type DependencyEdge,
} from "@/features/catalog/dependency-graph";
import type {
  CustomerWorkRequestMenu,
  DirectoryItem,
} from "@/services/entitlements.service";

type Stage = "select" | "review" | "done";

interface SubmitResult {
  workRequestId: string;
  itemCount: number;
  readyCount: number;
  autoIncluded: Array<{ label: string; serviceName: string }>;
}

export default function CustomerWorkRequestsPage() {
  const [menu, setMenu] = useState<CustomerWorkRequestMenu | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>("select");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customer/work-requests");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load your menu.");
        if (!cancelled) setMenu(body as CustomerWorkRequestMenu);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load your menu.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const edges = useMemo<DependencyEdge[]>(
    () =>
      (menu?.dependencies ?? []).map((d) => ({
        catalogItemId: d.catalog_item_id,
        dependsOnItemId: d.depends_on_item_id,
      })),
    [menu],
  );

  const directoryById = useMemo(
    () =>
      new Map<string, DirectoryItem>(
        (menu?.itemDirectory ?? []).map((item) => [item.id, item]),
      ),
    [menu],
  );

  // The whole connected chain the current selection would pull in, and which of
  // those items the system adds on the customer's behalf (to disclose).
  const closure = useMemo(
    () => resolveDependencyClosure([...selected], edges),
    [selected, edges],
  );
  const autoIncluded = useMemo(
    () =>
      closure.autoIncludedIds
        .map((id) => directoryById.get(id))
        .filter((item): item is DirectoryItem => Boolean(item)),
    [closure, directoryById],
  );

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/customer/work-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCatalogItemIds: [...selected] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not submit your request.");
      setResult(body as SubmitResult);
      setStage("done");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setSelected(new Set());
    setResult(null);
    setSubmitError(null);
    setStage("select");
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="New work order" />
        <Card title="We couldn't load your menu">
          <InlineErrorMessage message={loadError} />
        </Card>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="New work order" />
        <Card title="Loading your work orders…">
          <p className="text-sm text-slate-600">One moment.</p>
        </Card>
      </div>
    );
  }

  if (!menu.hasSubscription || menu.services.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader
          title="New work order"
          subtitle="Choose the work orders included in your package."
        />
        <Card title="No work orders available">
          <EmptyStateNoticeCard
            title="No active package"
            description={
              menu.hasSubscription
                ? "Your package doesn't include any services yet. Contact your account manager."
                : "You need an active subscription before you can request work orders."
            }
            action={
              <Link href="/customer/billing">
                <Button variant="ghost">View billing</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  // ─── Confirmation ─────────────────────────────────────────────────────────
  if (stage === "done" && result) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader
          title="Work order submitted"
          subtitle="We've routed each order to the right service provider."
        />
        <Card
          title={`${result.itemCount} work order${result.itemCount === 1 ? "" : "s"} created`}
          description={`${result.readyCount} ready to start now; the rest will begin once their prerequisites finish.`}
        >
          {result.autoIncluded.length > 0 ? (
            <div className="mt-2">
              <p className="text-sm font-medium text-slate-900">
                We also included these required steps:
              </p>
              <ul className="mt-2 space-y-1">
                {result.autoIncluded.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-600">
                    • {item.label}
                    {item.serviceName ? (
                      <span className="text-slate-400"> — {item.serviceName}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Link href={`/customer/work-requests/${result.workRequestId}` as Route}>
              <Button>Track this request</Button>
            </Link>
            <Button variant="ghost" onClick={startOver}>
              Request more work
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Review & disclose ────────────────────────────────────────────────────
  if (stage === "review") {
    const pickedItems = [...selected]
      .map((id) => directoryById.get(id))
      .filter((item): item is DirectoryItem => Boolean(item));

    return (
      <div className="space-y-6">
        <DashboardPageHeader
          title="Review your request"
          subtitle="Confirm what you're requesting before we route it."
        />
        <Card title="You selected" description="The work orders you chose.">
          <ul className="space-y-1">
            {pickedItems.map((item) => (
              <li key={item.id} className="text-sm text-slate-700">
                • {item.label}
                {item.serviceName ? (
                  <span className="text-slate-400"> — {item.serviceName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        {autoIncluded.length > 0 ? (
          <Card
            title="Required steps we'll add"
            description="These are needed to complete what you asked for, so we've included them automatically."
          >
            <ul className="space-y-1">
              {autoIncluded.map((item) => (
                <li key={item.id} className="text-sm text-slate-700">
                  • {item.label}
                  {item.serviceName ? (
                    <span className="text-slate-400"> — {item.serviceName}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {submitError ? <InlineErrorMessage message={submitError} /> : null}

        <div className="flex gap-3">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Confirm & submit"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setStage("select")}
            disabled={submitting}
          >
            Back to selection
          </Button>
        </div>
      </div>
    );
  }

  // ─── Selection ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="New work order"
        subtitle="Choose the work orders included in your package."
        badge={
          <Badge>
            {selected.size} selected
          </Badge>
        }
      />

      {menu.services.map((service) => (
        <Card key={service.id} title={service.name}>
          {service.items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No work orders available in this service.
            </p>
          ) : (
            <ul className="space-y-2">
              {service.items.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-coral"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button
          onClick={() => setStage("review")}
          disabled={selected.size === 0}
        >
          Review selection
        </Button>
        {autoIncluded.length > 0 ? (
          <p className="text-xs text-slate-500">
            {autoIncluded.length} required step
            {autoIncluded.length === 1 ? "" : "s"} will be added automatically.
          </p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectMenu } from "@/components/ui/select-menu";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";

type PartnerRow = {
  id: string;
  packageStream: string;
  name: string;
  site: string;
};

type RoutingRec = {
  id: string;
  organizationId: string;
  organizationName: string;
  stream: string;
  recommendedPartnerId: string | null;
  recommendedPartnerName: string;
  priority: string;
  confidence: number;
  source: string;
  explanation: string;
  status: string;
  createdAt: string;
  alternativePartners: Array<{ id: string; name: string }>;
};

const PRIORITY_CLASSES: Record<string, string> = {
  strategic: "bg-purple-500/20 text-purple-200 border-purple-400/40",
  critical: "bg-red-500/20 text-red-200 border-red-400/40",
  high: "bg-orange-500/20 text-orange-200 border-orange-400/40",
  standard: "bg-slate-500/20 text-slate-300 border-slate-400/40",
};

const SOURCE_CLASSES: Record<string, string> = {
  rule: "bg-cyan-500/20 text-cyan-200 border-cyan-400/40",
  ai: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  hybrid: "bg-blue-500/20 text-blue-200 border-blue-400/40",
  manual: "bg-slate-500/20 text-slate-300 border-slate-400/40",
};

type AnomalyRow = {
  id: string;
  organizationId: string;
  submissionId: string;
  anomalyType: string;
  reason: string;
  severity: "low" | "medium" | "high";
  status: string;
  createdAt: string;
  organizationName: string;
  businessTitle: string;
  primaryIndustry: string | null;
  businessModel: string | null;
  country: string | null;
};

type OverviewMetricsPayload = {
  metrics: {
    activeOrders: number;
    completedOrders: number;
    activePartners: number;
    activeCustomers: number;
    queueFailed: number;
    queueQueued: number;
    staleHandoffs: number;
  };
  alerts: string[];
};

type AdminKpiCard = {
  id: string;
  title: string;
  value: number;
  unit: "count" | "percent";
  trendDeltaPct: number;
  trendDirection: "up" | "down" | "flat";
  formula: string;
  drillDownHref: string;
  drillDownLabel: string;
};

type AdminKpiPayload = {
  window: {
    from: string;
    to: string;
  };
  cards: AdminKpiCard[];
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  revenue_volume_contradiction: "Revenue / Volume Mismatch",
  employee_revenue_mismatch: "Employee / Revenue Mismatch",
  inventory_fulfillment_contradiction: "Inventory / Fulfillment Conflict",
  high_volume_single_channel: "High Volume — Single Channel",
  service_provider_b2c_volume: "Service Provider B2C Volume",
  regulated_minimal_footprint: "Regulated — Minimal Footprint",
  enterprise_tier_profile_mismatch: "Enterprise Tier Mismatch",
  low_confidence_profile: "Low Confidence Profile",
};

const SEVERITY_CLASSES: Record<"low" | "medium" | "high", string> = {
  high: "border-coral/40 bg-coral/10 text-coral",
  medium: "border-amber-400/30 bg-amber-400/10 text-slate-300",
  low: "border-yellow-400/20 bg-yellow-400/5 text-yellow-300",
};

function normalizeSite(site: string) {
  if (/^https?:\/\//i.test(site)) {
    return site;
  }
  return `https://${site}`;
}

export default function AdminDashboardPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [streams, setStreams] = useState<string[]>([]);
  const [activeStream, setActiveStream] = useState<string>("all");
  const [newStream, setNewStream] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newSite, setNewSite] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Routing recommendations state ─────────────────────────────────────────
  const [routingRecs, setRoutingRecs] = useState<RoutingRec[]>([]);
  const [routingPendingCount, setRoutingPendingCount] = useState(0);
  const [routingLoading, setRoutingLoading] = useState(true);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routingActioning, setRoutingActioning] = useState<string | null>(null);
  // Inline override form state
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overridePartnerId, setOverridePartnerId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [anomalyPendingCount, setAnomalyPendingCount] = useState(0);
  const [anomaliesLoading, setAnomaliesLoading] = useState(true);
  const [anomaliesError, setAnomaliesError] = useState<string | null>(null);
  const [anomalyActioning, setAnomalyActioning] = useState<string | null>(null);
  const [overviewMetrics, setOverviewMetrics] = useState<
    OverviewMetricsPayload["metrics"] | null
  >(null);
  const [overviewAlerts, setOverviewAlerts] = useState<string[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [kpiCards, setKpiCards] = useState<AdminKpiCard[]>([]);
  const [kpiWindow, setKpiWindow] = useState<AdminKpiPayload["window"] | null>(
    null,
  );
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const loadKpiCards = async () => {
    setKpiLoading(true);
    setKpiError(null);

    try {
      const response = await fetch("/api/admin/dashboard-kpis", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        window?: AdminKpiPayload["window"];
        cards?: AdminKpiCard[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load KPI cards.");
      }

      setKpiCards(body.cards ?? []);
      setKpiWindow(body.window ?? null);
    } catch (loadError) {
      setKpiError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load KPI cards.",
      );
    } finally {
      setKpiLoading(false);
    }
  };

  const loadOverviewMetrics = async () => {
    setOverviewLoading(true);
    setOverviewError(null);

    try {
      const response = await fetch("/api/admin/overview-metrics", {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        metrics?: OverviewMetricsPayload["metrics"];
        alerts?: string[];
      };

      if (!response.ok || !body.metrics) {
        throw new Error(body.error ?? "Could not load overview metrics.");
      }

      setOverviewMetrics(body.metrics);
      setOverviewAlerts(body.alerts ?? []);
    } catch (loadError) {
      setOverviewError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load overview metrics.",
      );
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadPartners = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/service-partners", {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        streams?: string[];
        partners?: PartnerRow[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load service partner data.");
      }

      const streamValues = body.streams ?? [];
      setStreams(streamValues);
      setPartners(body.partners ?? []);
      setNewStream((current) => current || streamValues[0] || "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load service partner data.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnomalies = async () => {
    setAnomaliesLoading(true);
    setAnomaliesError(null);

    try {
      const response = await fetch("/api/admin/onboarding-anomalies", {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        anomalies?: AnomalyRow[];
        pendingCount?: number;
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? "Could not load onboarding anomaly alerts.",
        );
      }

      setAnomalies(body.anomalies ?? []);
      setAnomalyPendingCount(body.pendingCount ?? 0);
    } catch (loadError) {
      setAnomaliesError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load onboarding anomaly alerts.",
      );
    } finally {
      setAnomaliesLoading(false);
    }
  };

  const handleAnomalyAction = async (
    id: string,
    action: "reviewed" | "dismissed",
  ) => {
    if (anomalyActioning) return;
    setAnomalyActioning(id);

    try {
      const response = await fetch(`/api/admin/onboarding-anomalies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: action }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not update anomaly alert.");
      }

      setAnomalies((current) => current.filter((a) => a.id !== id));
      setAnomalyPendingCount((n) => Math.max(0, n - 1));
    } catch (actionError) {
      setAnomaliesError(
        actionError instanceof Error
          ? actionError.message
          : "Could not update anomaly alert.",
      );
    } finally {
      setAnomalyActioning(null);
    }
  };

  useEffect(() => {
    void loadOverviewMetrics();
    void loadKpiCards();
    void loadPartners();
    void loadRoutingRecs();
    void loadAnomalies();
  }, []);

  const streamOptions = useMemo(() => streams, [streams]);

  const adminMetrics = useMemo(
    () => [
      {
        id: "mapped-partners",
        label: "Mapped Partners",
        value: String(partners.length),
        hint: "Active service partner records",
      },
      {
        id: "active-streams",
        label: "Active Streams",
        value: String(streams.length),
        hint: "Package streams with configured partners",
      },
      {
        id: "routing-pending",
        label: "Routing Pending",
        value: String(routingPendingCount),
        hint: "Routing recommendations awaiting decisions",
      },
      {
        id: "anomaly-pending",
        label: "Anomalies Pending",
        value: String(anomalyPendingCount),
        hint: "Onboarding anomaly alerts awaiting review",
      },
    ],
    [anomalyPendingCount, partners.length, routingPendingCount, streams.length],
  );

  const visiblePartners = useMemo(() => {
    if (activeStream === "all") {
      return partners;
    }

    return partners.filter((partner) => partner.packageStream === activeStream);
  }, [activeStream, partners]);

  const addPartner = async () => {
    if (!newStream.trim() || !newName.trim() || !newSite.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/service-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageStream: newStream,
          name: newName.trim(),
          site: newSite.trim(),
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        partner?: PartnerRow;
      };

      if (!response.ok || !body.partner) {
        throw new Error(body.error ?? "Could not create service partner.");
      }

      const createdPartner = body.partner;
      setPartners((current) => [createdPartner, ...current]);
      setNewName("");
      setNewSite("");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create service partner.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Routing recommendation loaders / actions ──────────────────────────────
  const loadRoutingRecs = async () => {
    setRoutingLoading(true);
    setRoutingError(null);
    try {
      const response = await fetch(
        "/api/admin/routing-recommendations?status=pending",
        { credentials: "include" },
      );
      const body = (await response.json()) as {
        error?: string;
        recommendations?: RoutingRec[];
        pendingCount?: number;
      };
      if (!response.ok) {
        throw new Error(
          body.error ?? "Could not load provider routing recommendations.",
        );
      }
      setRoutingRecs(body.recommendations ?? []);
      setRoutingPendingCount(body.pendingCount ?? 0);
    } catch (e) {
      setRoutingError(
        e instanceof Error
          ? e.message
          : "Could not load provider routing recommendations.",
      );
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleRoutingAction = async (
    id: string,
    action: "accept" | "dismiss",
  ) => {
    if (routingActioning) return;
    setRoutingActioning(id);
    try {
      const response = await fetch(`/api/admin/routing-recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? `Could not ${action} recommendation.`);
      }
      setRoutingRecs((current) => current.filter((r) => r.id !== id));
      setRoutingPendingCount((n) => Math.max(0, n - 1));
    } catch (e) {
      setRoutingError(
        e instanceof Error ? e.message : `Could not ${action} recommendation.`,
      );
    } finally {
      setRoutingActioning(null);
    }
  };

  const handleRoutingOverride = async (id: string) => {
    if (!overridePartnerId || !overrideReason.trim() || routingActioning) {
      return;
    }
    setRoutingActioning(id);
    try {
      const response = await fetch(`/api/admin/routing-recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "override",
          newPartnerId: overridePartnerId,
          reason: overrideReason.trim(),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        newPartnerName?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not override recommendation.");
      }
      setRoutingRecs((current) => current.filter((r) => r.id !== id));
      setRoutingPendingCount((n) => Math.max(0, n - 1));
      setOverrideTarget(null);
      setOverridePartnerId("");
      setOverrideReason("");
    } catch (e) {
      setRoutingError(
        e instanceof Error ? e.message : "Could not override recommendation.",
      );
    } finally {
      setRoutingActioning(null);
    }
  };

  const removePartner = async (id: string) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/service-partners/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not remove service partner.");
      }

      setPartners((current) => current.filter((partner) => partner.id !== id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove service partner.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <DashboardLoadingSkeleton metricCount={4} listCount={3} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Admin Dashboard</h2>
          <p className="mt-2 text-sm text-slate-200/85">
            Central oversight for package coverage, service partners,
            governance, and AI operations.
          </p>
        </div>
        <Badge>Management Console</Badge>
      </div>

      <Card
        title="System Oversight"
        description="A live snapshot of how orders, handoffs, and the dispatch queue are performing right now."
      >
        {overviewError ? (
          <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {overviewError}
          </p>
        ) : null}

        {overviewLoading ? (
          <p className="text-xs text-slate-300">Loading overview metrics...</p>
        ) : overviewMetrics ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  Active Orders
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {overviewMetrics.activeOrders}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  Completed Orders
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {overviewMetrics.completedOrders}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  Active Partners
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {overviewMetrics.activePartners}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  Active Customers
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {overviewMetrics.activeCustomers}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2 xl:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  Queue Failed
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {overviewMetrics.queueFailed}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2 xl:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  Queue Queued
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {overviewMetrics.queueQueued}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2 xl:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  Stale Handoffs &gt; 24h
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {overviewMetrics.staleHandoffs}
                </p>
              </div>
            </div>

            {overviewAlerts.length > 0 ? (
              <div className="mt-4 space-y-2">
                {overviewAlerts.map((alert, index) => (
                  <p
                    key={`${alert}-${index}`}
                    className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                  >
                    {alert}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-emerald-200">
                No critical system alerts right now.
              </p>
            )}
          </>
        ) : null}
      </Card>

      <Card
        title="KPI Drilldowns"
        description={
          kpiWindow
            ? `Trend window: ${new Date(kpiWindow.from).toLocaleDateString()} - ${new Date(kpiWindow.to).toLocaleDateString()}`
            : "Trend window: last 7 days"
        }
      >
        {kpiError ? (
          <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {kpiError}
          </p>
        ) : null}

        {kpiLoading ? (
          <p className="text-xs text-slate-300">Loading KPI drilldowns...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <div
                key={card.id}
                className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-300">
                  {card.title}
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {card.unit === "percent"
                    ? `${card.value.toFixed(2)}%`
                    : card.value}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {card.trendDirection === "up"
                    ? "↑"
                    : card.trendDirection === "down"
                      ? "↓"
                      : "→"}{" "}
                  {Math.abs(card.trendDeltaPct).toFixed(1)}% vs prior 7 days
                </p>
                <p className="mt-1 text-[11px] text-slate-400 flex-1">
                  {card.formula}
                </p>
                <a
                  href={card.drillDownHref}
                  className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                >
                  {card.drillDownLabel} →
                </a>
              </div>
            ))}

            {kpiCards.length === 0 ? (
              <p className="text-xs text-slate-400">No KPI cards available.</p>
            ) : null}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminMetrics.map((metric) => (
          <Card key={metric.id} title={metric.label} description={metric.hint}>
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
          </Card>
        ))}
      </div>

      <Card
        title="Service Partner Management"
        description="Assign and adjust which partners handle each service type."
      >
        <div className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs text-slate-300">
              Stream
              <SelectMenu
                className="mt-1"
                value={newStream}
                onChange={(nextValue) => setNewStream(nextValue)}
                disabled={isLoading || isSaving || streamOptions.length === 0}
                options={streamOptions.map((stream) => ({
                  value: stream,
                  label: stream,
                }))}
              />
            </label>

            <label className="text-xs text-slate-300 md:col-span-1">
              Partner Name
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                placeholder="Partner name"
                disabled={isLoading || isSaving}
              />
            </label>

            <label className="text-xs text-slate-300 md:col-span-1">
              Website
              <input
                value={newSite}
                onChange={(event) => setNewSite(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                placeholder="www.example.com"
                disabled={isLoading || isSaving}
              />
            </label>

            <div className="flex items-end">
              <Button
                onClick={addPartner}
                className="w-full"
                disabled={isLoading || isSaving || streamOptions.length === 0}
              >
                {isSaving ? "Saving..." : "Add Partner"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeStream === "all" ? "primary" : "ghost"}
              onClick={() => setActiveStream("all")}
            >
              All Streams
            </Button>
            {streamOptions.map((stream) => (
              <Button
                key={stream}
                variant={activeStream === stream ? "primary" : "ghost"}
                onClick={() => setActiveStream(stream)}
              >
                {stream}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">Stream</th>
                  <th className="px-3 py-2">Partner</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {visiblePartners.map((partner) => (
                  <tr key={partner.id} className="border-b border-white/10">
                    <td className="px-3 py-2">{partner.packageStream}</td>
                    <td className="px-3 py-2">{partner.name}</td>
                    <td className="px-3 py-2">
                      <a
                        href={normalizeSite(partner.site)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 hover:text-cyan-200"
                      >
                        {partner.site}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        onClick={() => void removePartner(partner.id)}
                        disabled={isSaving}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {visiblePartners.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={4}>
                      No partners mapped for this stream.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* ── Provider Routing Queue ──────────────────────────────────────────── */}
      <Card
        title={`Provider Routing Queue${routingPendingCount > 0 ? ` (${routingPendingCount} pending)` : ""}`}
        description="Suggested partner assignments for incoming orders. Review each one and confirm, swap, or ignore."
      >
        <div className="space-y-3">
          {routingError ? (
            <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {routingError}
            </p>
          ) : null}

          {routingLoading ? (
            <p className="text-xs text-slate-400">
              Loading routing recommendations…
            </p>
          ) : routingRecs.length === 0 ? (
            <p className="text-xs text-slate-400">
              No pending routing recommendations.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                    <th className="px-3 py-2">Organisation</th>
                    <th className="px-3 py-2">Stream</th>
                    <th className="px-3 py-2">Recommended Partner</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {routingRecs.map((rec) => (
                    <Fragment key={rec.id}>
                      <tr className="border-b border-white/10 align-top">
                        <td className="px-3 py-2 text-xs">
                          {rec.organizationName}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-white">
                          {rec.stream}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {rec.recommendedPartnerName}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${PRIORITY_CLASSES[rec.priority] ?? PRIORITY_CLASSES.standard}`}
                          >
                            {rec.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          {rec.confidence}%
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${SOURCE_CLASSES[rec.source] ?? SOURCE_CLASSES.manual}`}
                          >
                            {rec.source}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-300">
                          {rec.explanation}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              variant="ghost"
                              onClick={() =>
                                void handleRoutingAction(rec.id, "accept")
                              }
                              disabled={Boolean(routingActioning)}
                              className="text-emerald-300 hover:text-emerald-200"
                            >
                              Accept
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setOverrideTarget(
                                  overrideTarget === rec.id ? null : rec.id,
                                );
                                setOverridePartnerId(
                                  rec.alternativePartners[0]?.id ?? "",
                                );
                                setOverrideReason("");
                              }}
                              disabled={Boolean(routingActioning)}
                              className="text-slate-300 hover:text-slate-200"
                            >
                              Override
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                void handleRoutingAction(rec.id, "dismiss")
                              }
                              disabled={Boolean(routingActioning)}
                              className="text-slate-400 hover:text-slate-200"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline override form — shown below the row it targets */}
                      {overrideTarget === rec.id ? (
                        <tr className="border-b border-amber-400/20 bg-amber-500/5">
                          <td colSpan={8} className="px-3 py-3">
                            <p className="mb-2 text-xs font-semibold text-slate-200">
                              Override routing for{" "}
                              <span className="text-white">
                                {rec.organizationName}
                              </span>{" "}
                              → {rec.stream}
                            </p>
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="text-xs text-slate-300">
                                New Partner
                                <SelectMenu
                                  className="mt-1 w-52"
                                  value={overridePartnerId}
                                  onChange={(nextValue) =>
                                    setOverridePartnerId(nextValue)
                                  }
                                  options={
                                    rec.alternativePartners.length === 0
                                      ? [
                                          {
                                            value: "",
                                            label:
                                              "No alternatives in this stream",
                                            disabled: true,
                                          },
                                        ]
                                      : rec.alternativePartners.map((p) => ({
                                          value: p.id,
                                          label: p.name,
                                        }))
                                  }
                                  disabled={
                                    rec.alternativePartners.length === 0
                                  }
                                />
                              </label>
                              <label className="flex-1 text-xs text-slate-300">
                                Reason
                                <input
                                  className="mt-1 h-9 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
                                  placeholder="Why are you overriding this recommendation?"
                                  value={overrideReason}
                                  onChange={(e) =>
                                    setOverrideReason(e.target.value)
                                  }
                                />
                              </label>
                              <div className="flex gap-2 pb-0.5">
                                <Button
                                  onClick={() =>
                                    void handleRoutingOverride(rec.id)
                                  }
                                  disabled={
                                    Boolean(routingActioning) ||
                                    !overridePartnerId ||
                                    !overrideReason.trim()
                                  }
                                >
                                  {routingActioning === rec.id
                                    ? "Saving…"
                                    : "Confirm Override"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setOverrideTarget(null);
                                    setOverridePartnerId("");
                                    setOverrideReason("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Pending Approvals"
          description="Items waiting on a decision before work can continue."
        >
          <div className="space-y-3">
            {routingRecs.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">
                  Review routing: {task.organizationName}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Stream: {task.stream} | Source: {task.source}
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Status: {task.status}
                </p>
              </div>
            ))}
            {routingRecs.length === 0 ? (
              <p className="text-xs text-slate-400">
                No pending governance tasks right now.
              </p>
            ) : null}
          </div>
        </Card>

        <Card
          title="Critical Alerts"
          description="Recent alerts that may need your attention."
        >
          <div className="space-y-3">
            {anomalies.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-coral">
                  {ANOMALY_TYPE_LABELS[alert.anomalyType] ?? alert.anomalyType}
                </p>
                <p className="mt-1 text-xs text-slate-300">{alert.reason}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Source: onboarding-anomaly
                </p>
              </div>
            ))}
            {anomalies.length === 0 ? (
              <p className="text-xs text-slate-400">No critical alerts.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card
        title={`Onboarding Anomaly Alerts${anomalyPendingCount > 0 ? ` (${anomalyPendingCount} pending)` : ""}`}
        description="Submissions that were flagged during onboarding and need a manual check before they can proceed."
      >
        {anomaliesError ? (
          <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {anomaliesError}
          </p>
        ) : null}

        {anomaliesLoading ? (
          <p className="text-xs text-slate-400">Loading anomaly alerts...</p>
        ) : anomalies.length === 0 ? (
          <p className="text-xs text-slate-400">
            No pending anomaly alerts — all onboarding submissions are clean.
          </p>
        ) : (
          <div className="space-y-3">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_CLASSES[anomaly.severity]}`}
                      >
                        {anomaly.severity}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {ANOMALY_TYPE_LABELS[anomaly.anomalyType] ??
                          anomaly.anomalyType}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-slate-300">
                      {anomaly.reason}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                      <span>
                        <span className="text-slate-500">Organisation: </span>
                        {anomaly.organizationName}
                      </span>
                      <span>
                        <span className="text-slate-500">Submission: </span>
                        {anomaly.businessTitle}
                      </span>
                      {anomaly.businessModel ? (
                        <span>
                          <span className="text-slate-500">Model: </span>
                          {anomaly.businessModel}
                        </span>
                      ) : null}
                      {anomaly.country ? (
                        <span>
                          <span className="text-slate-500">Country: </span>
                          {anomaly.country}
                        </span>
                      ) : null}
                      <span>
                        <span className="text-slate-500">Flagged: </span>
                        {new Date(anomaly.createdAt).toLocaleDateString(
                          "en-ZA",
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      disabled={anomalyActioning === anomaly.id}
                      onClick={() =>
                        void handleAnomalyAction(anomaly.id, "reviewed")
                      }
                    >
                      Mark Reviewed
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 px-3 text-xs text-slate-400 hover:text-white"
                      disabled={anomalyActioning === anomaly.id}
                      onClick={() =>
                        void handleAnomalyAction(anomaly.id, "dismissed")
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="AI Governance Recommendations"
          description="How confident the system is in each suggestion and what action was taken."
        >
          <div className="space-y-3">
            {routingRecs.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm text-white">{item.organizationName}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {item.explanation}
                </p>
                <p className="mt-2 text-xs text-slate-200">
                  Action: {item.status} (confidence {item.confidence}%)
                </p>
              </div>
            ))}
            {routingRecs.length === 0 ? (
              <p className="text-xs text-slate-400">
                No AI governance recommendations pending.
              </p>
            ) : null}
          </div>
        </Card>

        <Card
          title="AI Scenario Library"
          description="Which types of requests the system can handle automatically."
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="text-sm font-semibold text-white">
                Scenario definitions are now sourced from live workflow
                behavior.
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Use routing and anomaly queues above to validate current model
                output.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Static mock scenario libraries have been removed from this
                dashboard.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

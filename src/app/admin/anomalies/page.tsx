"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectMenu } from "@/components/ui/select-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnomalyArea = "orders" | "inventory" | "onboarding" | "workflow";
type AnomalySeverity = "low" | "medium" | "high";

type AnomalyRow = {
  id: string;
  area: AnomalyArea;
  anomalyType: string;
  severity: AnomalySeverity;
  reason: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  sourceLabel: string | null;
  isExample: boolean;
  status: string;
  createdAt: string;
};

// ─── Display maps ─────────────────────────────────────────────────────────────

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  duplicate_po_reference: "Duplicate PO Reference",
  order_status_stalled: "Order Status Stalled",
  rapid_status_cycling: "Rapid Status Cycling",
  negative_stock_detected: "Negative Stock Detected",
  low_stock_warning: "Low Stock Warning",
  duplicate_organization_name: "Duplicate Organisation Name",
  revenue_volume_contradiction: "Revenue / Volume Mismatch",
  employee_revenue_mismatch: "Employee / Revenue Mismatch",
  inventory_fulfillment_contradiction: "Inventory / Fulfillment Conflict",
  high_volume_single_channel: "High Volume — Single Channel",
  service_provider_b2c_volume: "Service Provider B2C Volume",
  regulated_minimal_footprint: "Regulated — Minimal Footprint",
  enterprise_tier_profile_mismatch: "Enterprise Tier Mismatch",
  low_confidence_profile: "Low Confidence Profile",
};

const AREA_LABELS: Record<AnomalyArea, string> = {
  orders: "Orders",
  inventory: "Inventory",
  onboarding: "Onboarding",
  workflow: "Workflow",
};

const SEVERITY_CLASSES: Record<AnomalySeverity, string> = {
  high: "border-coral/40 bg-coral/10 text-coral",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  low: "border-yellow-400/20 bg-yellow-400/5 text-yellow-300",
};

const AREA_CLASSES: Record<AnomalyArea, string> = {
  orders: "bg-blue-500/20 text-blue-200 border-blue-400/40",
  inventory: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  onboarding: "bg-purple-500/20 text-purple-200 border-purple-400/40",
  workflow: "bg-orange-500/20 text-orange-200 border-orange-400/40",
};

const AREA_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Areas" },
  { value: "orders", label: "Orders" },
  { value: "inventory", label: "Inventory" },
  { value: "workflow", label: "Workflow" },
  { value: "onboarding", label: "Onboarding" },
];

const SINCE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function sinceParamToIso(since: string): string {
  if (!since) return "";
  const days = since === "7d" ? 7 : since === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnomaliesPage() {
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const [activeArea, setActiveArea] = useState("all");
  const [sinceFilter, setSinceFilter] = useState("30d");
  const [showExamples, setShowExamples] = useState(false);

  const loadAnomalies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ status: "pending_review" });
      if (activeArea !== "all") params.set("area", activeArea);
      const sinceIso = sinceParamToIso(sinceFilter);
      if (sinceIso) params.set("since", sinceIso);
      if (showExamples) params.set("include_examples", "true");

      const response = await fetch(`/api/admin/anomalies?${params.toString()}`, {
        credentials: "include",
      });

      const body = (await response.json()) as {
        error?: string;
        anomalies?: Array<{
          id: string;
          area: AnomalyArea;
          anomaly_type: string;
          severity: AnomalySeverity;
          reason: string;
          source_entity_type: string | null;
          source_entity_id: string | null;
          source_label: string | null;
          is_example: boolean;
          status: string;
          created_at: string;
        }>;
        pendingCount?: number;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load anomaly alerts.");
      }

      setAnomalies(
        (body.anomalies ?? []).map((row) => ({
          id: row.id,
          area: row.area,
          anomalyType: row.anomaly_type,
          severity: row.severity,
          reason: row.reason,
          sourceEntityType: row.source_entity_type,
          sourceEntityId: row.source_entity_id,
          sourceLabel: row.source_label,
          isExample: row.is_example,
          status: row.status,
          createdAt: row.created_at,
        })),
      );
      setPendingCount(body.pendingCount ?? 0);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load anomaly alerts.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeArea, sinceFilter, showExamples]);

  useEffect(() => {
    void loadAnomalies();
  }, [loadAnomalies]);

  const handleAction = async (id: string, action: "reviewed" | "dismissed") => {
    if (actioning) return;
    setActioning(id);

    try {
      const response = await fetch(`/api/admin/anomalies/${id}`, {
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
      setPendingCount((n) => Math.max(0, n - 1));
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not update anomaly alert.",
      );
    } finally {
      setActioning(null);
    }
  };

  const countBySeverity = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const a of anomalies) counts[a.severity]++;
    return counts;
  }, [anomalies]);

  const metrics = [
    { id: "pending", label: "Pending Review", value: String(pendingCount), hint: "Live anomalies awaiting ops review" },
    { id: "high", label: "High Severity", value: String(countBySeverity.high), hint: "Require immediate attention" },
    { id: "medium", label: "Medium Severity", value: String(countBySeverity.medium), hint: "Review within 24 hours" },
    { id: "low", label: "Low Severity", value: String(countBySeverity.low), hint: "Review at next ops cycle" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Exception & Anomaly Detection
          </h2>
          <p className="mt-2 text-sm text-slate-200/85">
            Unusual patterns detected across orders, inventory, workflow, and
            onboarding. High-severity items require prompt review.
          </p>
        </div>
        <Badge>AI Detection</Badge>
      </div>

      {/* ── Metrics ────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.id} title={m.label} description={m.hint}>
            <p className="text-3xl font-semibold text-white">{m.value}</p>
          </Card>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card
        title="Anomaly Queue"
        description="Detected exceptions awaiting review. Dismiss noise; mark genuine issues reviewed after actioning."
      >
        <div className="space-y-4">
          {/* Area tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {AREA_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={activeArea === tab.value ? "primary" : "ghost"}
                onClick={() => setActiveArea(tab.value)}
              >
                {tab.label}
              </Button>
            ))}

            <div className="ml-auto flex items-center gap-3">
              {/* Time period */}
              <SelectMenu
                value={sinceFilter}
                onChange={setSinceFilter}
                options={SINCE_OPTIONS}
              />

              {/* Example toggle */}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={showExamples}
                  onChange={(e) => setShowExamples(e.target.checked)}
                  className="accent-cyan-400"
                />
                Include examples
              </label>
            </div>
          </div>

          {/* Error */}
          {error ? (
            <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {error}
            </p>
          ) : null}

          {/* List */}
          {isLoading ? (
            <p className="text-xs text-slate-400">Scanning for anomalies…</p>
          ) : anomalies.length === 0 ? (
            <p className="text-xs text-slate-400">
              No anomalies found for the selected filters.
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
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_CLASSES[anomaly.severity]}`}
                        >
                          {anomaly.severity}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${AREA_CLASSES[anomaly.area]}`}
                        >
                          {AREA_LABELS[anomaly.area]}
                        </span>
                        {anomaly.isExample ? (
                          <span className="inline-flex items-center rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[11px] text-slate-400">
                            example
                          </span>
                        ) : null}
                        <span className="text-sm font-semibold text-white">
                          {ANOMALY_TYPE_LABELS[anomaly.anomalyType] ??
                            anomaly.anomalyType}
                        </span>
                      </div>

                      {/* Explanation */}
                      <p className="mt-1.5 text-xs text-slate-300">
                        {anomaly.reason}
                      </p>

                      {/* Source context + date */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        {anomaly.sourceLabel ? (
                          <span>
                            <span className="text-slate-500">Source: </span>
                            {anomaly.sourceLabel}
                          </span>
                        ) : null}
                        {anomaly.sourceEntityType ? (
                          <span>
                            <span className="text-slate-500">Type: </span>
                            {anomaly.sourceEntityType.replace(/_/g, " ")}
                          </span>
                        ) : null}
                        <span>
                          <span className="text-slate-500">Detected: </span>
                          {new Date(anomaly.createdAt).toLocaleDateString(
                            "en-ZA",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        disabled={actioning === anomaly.id}
                        onClick={() => void handleAction(anomaly.id, "reviewed")}
                      >
                        {actioning === anomaly.id ? "Saving…" : "Mark Reviewed"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 px-3 text-xs text-slate-400 hover:text-white"
                        disabled={actioning === anomaly.id}
                        onClick={() => void handleAction(anomaly.id, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

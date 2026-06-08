"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import {
  MOCK_ADMIN_DASHBOARD_PACK,
  MOCK_AI_SCENARIOS,
} from "@/features/mock/dashboard-data";

type PartnerRow = {
  id: string;
  packageStream: string;
  name: string;
  site: string;
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

  useEffect(() => {
    void loadPartners();
  }, []);

  const streamOptions = useMemo(() => streams, [streams]);

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MOCK_ADMIN_DASHBOARD_PACK.metrics.map((metric) => (
          <Card key={metric.id} title={metric.label} description={metric.hint}>
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
            {metric.delta ? (
              <p className="mt-1 text-xs text-slate-300">{metric.delta}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <Card
        title="Service Partner Management"
        description="Manage partners mapped to each service stream."
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
              <select
                className="mt-1 h-10 w-full rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white"
                value={newStream}
                onChange={(event) => setNewStream(event.target.value)}
                disabled={isLoading || isSaving || streamOptions.length === 0}
              >
                {streamOptions.map((stream) => (
                  <option key={stream} value={stream}>
                    {stream}
                  </option>
                ))}
              </select>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Governance Tasks" description="Policy and approval tasks.">
          <div className="space-y-3">
            {MOCK_ADMIN_DASHBOARD_PACK.tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">{task.title}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Owner: {task.owner} | ETA: {task.eta}
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Status: {task.status}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Critical Alerts"
          description="Audit and security incidents."
        >
          <div className="space-y-3">
            {MOCK_ADMIN_DASHBOARD_PACK.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-coral">
                  {alert.title}
                </p>
                <p className="mt-1 text-xs text-slate-300">{alert.detail}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Source: {alert.source}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="AI Governance Recommendations"
          description="Recommendations with confidence and action mapping."
        >
          <div className="space-y-3">
            {MOCK_ADMIN_DASHBOARD_PACK.aiRecommendations.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">{item.reason}</p>
                <p className="mt-2 text-xs text-slate-200">
                  Action: {item.action} (confidence{" "}
                  {Math.round(item.confidence * 100)}%)
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="AI Scenario Library"
          description="Scenario coverage for AI ticketing."
        >
          <div className="space-y-3">
            {MOCK_AI_SCENARIOS.map((scenario) => (
              <div
                key={scenario.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">
                  {scenario.name}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {scenario.trigger}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {scenario.phase} | Expected: {scenario.expectedOutcome}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

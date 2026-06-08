"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";

type PartnerRequestStatus = "sent" | "acknowledged" | "failed";

type PartnerDashboardRequest = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  packageId: string | null;
  packageTierCode: string | null;
  packageTierName: string | null;
  packageStream: string;
  requestStatus: PartnerRequestStatus;
  sentAt: string;
  acknowledgedAt: string | null;
  providerName: string | null;
  requiredDocsTotal: number;
  requiredDocsPending: number;
  aiReadiness: {
    status: "high" | "medium" | "low" | "insufficient_signal";
    label: string;
    score: number | null;
    confidence: number | null;
    reasons: string[];
    modelVersion: string | null;
    docsCompleteness: number;
  };
};

type PartnerDashboardPayload = {
  partner: {
    id: string;
    name: string | null;
    offeredServiceStream: string | null;
  };
  requests: PartnerDashboardRequest[];
  summary: {
    total: number;
    sent: number;
    acknowledged: number;
    failed: number;
    pendingCustomerDocs: number;
    readyForExecution: number;
  };
};

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<PartnerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/partner/dashboard", { method: "GET" });
      const body = (await response.json().catch(() => null)) as
        | PartnerDashboardPayload
        | { error?: string }
        | null;

      if (
        !response.ok ||
        !body ||
        !("summary" in body) ||
        !("requests" in body) ||
        !("partner" in body)
      ) {
        setError(
          (body && "error" in body && typeof body.error === "string"
            ? body.error
            : null) ?? "Could not load partner dashboard.",
        );
        setPayload(null);
        setLoading(false);
        return;
      }

      console.group("[PartnerDashboard] Partner Request Intake");
      console.log("loggedInPartner", {
        partnerId: body.partner.id,
        partnerName: body.partner.name,
        offeredServiceStream: body.partner.offeredServiceStream,
      });
      console.log("summary", body.summary);

      const grouped = new Map<
        string,
        {
          organization: string;
          purchasedTier: string | null;
          packageStream: string;
          totalRequests: number;
          sent: number;
          acknowledged: number;
          failed: number;
          docsPendingTotal: number;
          docsRequiredTotal: number;
        }
      >();

      for (const request of body.requests) {
        const organization = request.organizationName || request.organizationId;
        const purchasedTier =
          request.packageTierName ||
          request.packageTierCode ||
          request.packageId;
        const key = `${organization}|${purchasedTier || "unknown"}|${request.packageStream}`;

        const current = grouped.get(key) ?? {
          organization,
          purchasedTier: purchasedTier ?? null,
          packageStream: request.packageStream,
          totalRequests: 0,
          sent: 0,
          acknowledged: 0,
          failed: 0,
          docsPendingTotal: 0,
          docsRequiredTotal: 0,
        };

        current.totalRequests += 1;
        if (request.requestStatus === "sent") current.sent += 1;
        if (request.requestStatus === "acknowledged") current.acknowledged += 1;
        if (request.requestStatus === "failed") current.failed += 1;
        current.docsPendingTotal += request.requiredDocsPending;
        current.docsRequiredTotal += request.requiredDocsTotal;

        grouped.set(key, current);
      }

      console.table(Array.from(grouped.values()));

      if (body.requests.length <= 20) {
        console.groupCollapsed("requestDetails");
        for (const request of body.requests) {
          console.log("request", {
            id: request.id,
            organization: request.organizationName || request.organizationId,
            purchasedTier:
              request.packageTierName ||
              request.packageTierCode ||
              request.packageId,
            packageStream: request.packageStream,
            status: request.requestStatus,
            requiredDocsPending: request.requiredDocsPending,
            requiredDocsTotal: request.requiredDocsTotal,
          });
        }
        console.groupEnd();
      }

      console.groupEnd();

      setPayload(body);
      setLoading(false);
    }

    void fetchDashboard();
  }, [refreshToken]);

  async function submitDecision(
    requestId: string,
    action: "accept" | "reject",
  ) {
    setProcessingRequestId(requestId);

    console.log("[PartnerDashboard] decision", { requestId, action });

    const response = await fetch("/api/partner/dashboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId, action }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Could not update request decision.");
      setProcessingRequestId(null);
      return;
    }

    setProcessingRequestId(null);
    setRefreshToken((value) => value + 1);
  }

  if (loading) {
    return <DashboardLoadingSkeleton metricCount={5} listCount={4} />;
  }

  if (error) {
    return <div className="py-10 text-center text-red-300">{error}</div>;
  }

  const summary = payload?.summary ?? {
    total: 0,
    sent: 0,
    acknowledged: 0,
    failed: 0,
    pendingCustomerDocs: 0,
    readyForExecution: 0,
  };

  const requests = payload?.requests ?? [];
  const newPings = requests.filter(
    (request) => request.requestStatus === "sent",
  );
  const acceptedRequests = requests.filter(
    (request) => request.requestStatus === "acknowledged",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Partner Dashboard
          </h2>
          <p className="mt-2 text-sm text-slate-200/85">
            Ping-first request operations for partner decisioning and
            customer-doc readiness.
          </p>
        </div>
        <Badge>{summary.total} Total Requests</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card
          title="New Pings"
          description="Needs accept/reject before execution."
        >
          <p className="text-3xl font-semibold text-white">{summary.sent}</p>
        </Card>
        <Card title="Accepted" description="Requests acknowledged by partner.">
          <p className="text-3xl font-semibold text-white">
            {summary.acknowledged}
          </p>
        </Card>
        <Card title="Rejected" description="Requests rejected by partner.">
          <p className="text-3xl font-semibold text-amber-300">
            {summary.failed}
          </p>
        </Card>
        <Card
          title="Pending Docs"
          description="Accepted requests waiting on customer files."
        >
          <p className="text-3xl font-semibold text-cyan-200">
            {summary.pendingCustomerDocs}
          </p>
        </Card>
        <Card
          title="Ready"
          description="Accepted requests with all required docs submitted."
        >
          <p className="text-3xl font-semibold text-emerald-300">
            {summary.readyForExecution}
          </p>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card
          title="Incoming Sales Requests"
          description="Accept or reject incoming sales-order requests."
        >
          <div className="space-y-2.5">
            {newPings.length > 0 ? (
              <div className="grid gap-x-2 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                {newPings.slice(0, 8).map((request) => (
                  <div
                    key={request.id}
                    className="group relative flex min-h-[175px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-transparent px-4 py-4"
                  >
                    <div className="relative flex h-full flex-col">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.18)]" />
                          <p className="truncate text-sm font-semibold text-white">
                            {request.organizationName || request.organizationId}
                          </p>
                        </div>

                        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-cyan-100">
                            #{request.id.slice(0, 8)}
                          </span>
                          <span className="rounded bg-white/8 px-2 py-0.5">
                            Tier:{" "}
                            {request.packageTierName ||
                              request.packageTierCode ||
                              request.packageId ||
                              "Unknown"}
                          </span>
                          <span className="rounded bg-white/8 px-2 py-0.5">
                            {request.packageStream}
                          </span>
                          <span className="rounded bg-amber-300/12 px-2 py-0.5 text-amber-100">
                            Docs: {request.requiredDocsPending}/
                            {request.requiredDocsTotal}
                          </span>
                        </div>

                        {request.aiReadiness.status !==
                        "insufficient_signal" ? (
                          <>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              <span
                                className={`rounded px-2 py-0.5 ${
                                  request.aiReadiness.status === "high"
                                    ? "bg-emerald-400/15 text-emerald-200"
                                    : request.aiReadiness.status === "medium"
                                      ? "bg-cyan-300/12 text-cyan-100"
                                      : "bg-amber-300/15 text-amber-200"
                                }`}
                              >
                                Readiness: {request.aiReadiness.label}
                              </span>
                              {request.aiReadiness.score !== null ? (
                                <span className="rounded bg-cyan-300/12 px-2 py-0.5 text-cyan-100">
                                  Score {request.aiReadiness.score}
                                </span>
                              ) : null}
                              {request.aiReadiness.confidence !== null ? (
                                <span className="rounded bg-white/8 px-2 py-0.5 text-slate-300">
                                  Confidence{" "}
                                  {Math.round(request.aiReadiness.confidence)}%
                                </span>
                              ) : null}
                            </div>

                            {request.aiReadiness.reasons[0] ? (
                              <p className="mt-1.5 text-[11px] text-slate-300">
                                {request.aiReadiness.reasons[0]}
                              </p>
                            ) : null}
                          </>
                        ) : null}

                        <p className="mt-2.5 font-mono text-[10px] text-slate-400">
                          Timestamp: {new Date(request.sentAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="mt-5 flex items-center justify-start gap-2">
                        <Button
                          className="h-8 rounded-md bg-emerald-500/90 px-3 text-xs text-slate-950 hover:bg-emerald-400"
                          disabled={processingRequestId === request.id}
                          onClick={() =>
                            void submitDecision(request.id, "accept")
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          variant="danger"
                          className="h-8 rounded-md px-3 text-xs"
                          disabled={processingRequestId === request.id}
                          onClick={() =>
                            void submitDecision(request.id, "reject")
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {newPings.length === 0 ? (
              <p className="text-sm text-slate-300">No new request pings.</p>
            ) : null}
          </div>
        </Card>

        <Card
          title="Sales Orders Queue"
          description="Accepted sales-order requests and operational status."
        >
          <div className="space-y-3">
            {acceptedRequests.slice(0, 8).map((request) => (
              <button
                key={request.id}
                type="button"
                className="w-full rounded-2xl border border-white/15 bg-transparent p-3 text-left transition hover:border-cyan-200/40"
                onClick={() => router.push(`/partner/dashboard/${request.id}`)}
              >
                <p className="text-sm font-semibold text-white">
                  {request.organizationName || request.organizationId}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Stream: {request.packageStream}
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  {request.requiredDocsPending > 0
                    ? `Waiting on customer docs (${request.requiredDocsPending}/${request.requiredDocsTotal} outstanding)`
                    : "All required docs submitted - ready for execution"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Accepted:{" "}
                  {request.acknowledgedAt
                    ? new Date(request.acknowledgedAt).toLocaleString()
                    : "-"}
                </p>
                <p className="mt-1 text-[11px] text-cyan-200/80">
                  Open details page
                </p>
              </button>
            ))}
            {acceptedRequests.length === 0 ? (
              <p className="text-sm text-slate-300">
                No accepted requests yet.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

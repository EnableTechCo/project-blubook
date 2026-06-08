"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, File, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";

type PartnerDashboardRequest = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  packageId: string | null;
  packageTierCode: string | null;
  packageTierName: string | null;
  packageStream: string;
  requestStatus: "sent" | "acknowledged" | "failed";
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
  requirementItems: Array<{
    id: string;
    title: string;
    evidenceType: string;
    status: string;
    updatedAt: string;
    uploadedFiles: Array<{
      id: string;
      fileName: string;
      storagePath: string | null;
      uploadedAt: string;
      signedUrl: string | null;
    }>;
  }>;
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

function getFileType(fileName: string): "pdf" | "image" | "other" {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf") {
    return "pdf";
  }

  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(extension)) {
    return "image";
  }

  return "other";
}

function FileEvidenceRow({
  fileName,
  uploadedAt,
  signedUrl,
}: {
  fileName: string;
  uploadedAt: string;
  signedUrl: string | null;
}) {
  const fileType = getFileType(fileName);
  const Icon =
    fileType === "pdf" ? FileText : fileType === "image" ? ImageIcon : File;
  const extensionLabel = fileName.split(".").pop()?.toUpperCase() ?? "FILE";
  const isPreviewable =
    Boolean(signedUrl) && (fileType === "pdf" || fileType === "image");

  return (
    <div className="group rounded-lg border border-amber-300/35 bg-gradient-to-r from-amber-200/8 to-white/5 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-amber-200/65 hover:from-amber-200/12">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md border border-amber-200/35 bg-amber-200/10 p-1.5 text-amber-100">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {signedUrl ? (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-xs font-medium text-cyan-200 hover:text-cyan-100"
                title={`Open ${fileName}`}
              >
                {fileName}
              </a>
            ) : (
              <span
                className="block truncate text-xs font-medium text-slate-200"
                title={fileName}
              >
                {fileName}
              </span>
            )}
            <p className="text-[11px] text-slate-400">
              Uploaded {new Date(uploadedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md border border-amber-200/35 bg-amber-200/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-100/95">
            {extensionLabel}
          </span>
          {signedUrl ? (
            <a
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-amber-300/45 bg-amber-300/10 p-1.5 text-amber-100 transition-colors hover:bg-amber-300/20"
              aria-label={`Open ${fileName}`}
              title={`Open ${fileName}`}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>

      {isPreviewable && signedUrl ? (
        <details className="mt-2 border-t border-amber-200/25 pt-2">
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-amber-100/90 hover:text-amber-50">
            Preview
          </summary>
          <div className="mt-2 overflow-hidden rounded-md border border-amber-300/35 bg-slate-950/35">
            {fileType === "image" ? (
              <img
                src={signedUrl}
                alt={fileName}
                className="w-full h-auto"
                loading="lazy"
              />
            ) : (
              <iframe
                src={signedUrl}
                title={`Preview ${fileName}`}
                className="h-[85vh] w-full"
                loading="lazy"
              />
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default function PartnerRequestDetailPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params?.requestId ?? "";

  const dashboardQuery = useQuery({
    queryKey: ["partner-dashboard", requestId],
    enabled: Boolean(requestId),
    queryFn: async (): Promise<PartnerDashboardPayload> => {
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
        throw new Error(
          (body && "error" in body && typeof body.error === "string"
            ? body.error
            : null) ?? "Could not load partner request details.",
        );
      }

      return body;
    },
  });

  const request = useMemo(
    () =>
      (dashboardQuery.data?.requests ?? []).find(
        (item) => item.id === requestId,
      ) ?? null,
    [dashboardQuery.data?.requests, requestId],
  );

  if (dashboardQuery.isLoading) {
    return <DashboardLoadingSkeleton metricCount={3} listCount={2} />;
  }

  if (dashboardQuery.isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-300">
          {dashboardQuery.error instanceof Error
            ? dashboardQuery.error.message
            : "Could not load partner request details."}
        </p>
        <Link href="/partner/dashboard" className="inline-flex">
          <Button variant="ghost">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-300">Request not found.</p>
        <Link href="/partner/dashboard" className="inline-flex">
          <Button variant="ghost">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const tierLabel =
    request.packageTierName ||
    request.packageTierCode ||
    request.packageId ||
    "Unknown";
  const readiness = request.aiReadiness;
  const readinessAccentClass =
    readiness.status === "high"
      ? "from-emerald-400/20 to-cyan-300/10 border-emerald-300/35"
      : readiness.status === "medium"
        ? "from-amber-300/20 to-cyan-300/10 border-amber-300/35"
        : "from-red-400/20 to-amber-300/10 border-red-300/35";
  const recommendationText =
    readiness.status === "high"
      ? "Recommended next step: proceed to execution readiness checks."
      : readiness.status === "medium"
        ? "Recommended next step: validate missing details before execution."
        : "Recommended next step: hold execution and request corrective inputs.";
  const requestStatusLabel =
    request.requestStatus === "acknowledged"
      ? "Accepted"
      : request.requestStatus === "sent"
        ? "Sent"
        : "Failed";
  const readinessScoreValue = Math.max(Math.min(readiness.score ?? 0, 100), 0);
  const confidenceValue =
    readiness.confidence !== null
      ? Math.max(Math.min(Math.round(readiness.confidence), 100), 0)
      : null;
  const readinessToneClass =
    readiness.status === "high"
      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
      : readiness.status === "medium"
        ? "border-amber-300/45 bg-amber-300/15 text-amber-100"
        : "border-red-300/45 bg-red-300/15 text-red-100";
  const confidenceToneClass =
    readiness.status === "high"
      ? "from-emerald-300 to-cyan-300"
      : readiness.status === "medium"
        ? "from-amber-300 to-cyan-300"
        : "from-red-300 to-amber-300";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Request Details</h2>
          <p className="mt-2 text-sm text-slate-200/85">
            Full customer request context for partner operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/partner/dashboard" className="inline-flex">
            <Button variant="ghost">Back to dashboard</Button>
          </Link>
        </div>
      </div>

      <Card
        title="Organization Intelligence Brief"
        description="Operational and AI readiness context for this request."
      >
        <div className="rounded-2xl border border-cyan-300/30 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(245,158,11,0.16)_0%,rgba(14,165,233,0.10)_42%,rgba(15,23,42,0.10)_100%)] p-4 md:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)] xl:items-center">
            <div className="space-y-3 xl:self-center">
              <div className="space-y-2">
                <div className="rounded-xl border border-white/15 bg-slate-950/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    Customer
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {request.organizationName || request.organizationId}
                  </p>
                </div>

                <div className="rounded-xl border border-white/15 bg-slate-950/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    Organization ID
                  </p>
                  <p className="mt-1 font-mono text-sm text-slate-200 break-all">
                    {request.organizationId}
                  </p>
                </div>

                <div className="rounded-xl border border-white/15 bg-slate-950/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    Service Required
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {request.packageStream}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] xl:self-center ${readinessAccentClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/90">
                    AI Decision Capsule
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    Readiness Intelligence
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${readinessToneClass}`}
                >
                  {readiness.label}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div
                  className="relative h-20 w-20 rounded-full"
                  style={{
                    background: `conic-gradient(rgba(103,232,249,0.95) ${readinessScoreValue}%, rgba(255,255,255,0.15) ${readinessScoreValue}% 100%)`,
                  }}
                >
                  <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-slate-950/75">
                    <div className="text-center leading-tight">
                      <p className="text-sm font-semibold text-white">
                        {readiness.score !== null ? readiness.score : "N/A"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-cyan-100/90">
                        Ready
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-slate-300">
                    Model Confidence
                  </p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-2 rounded-full bg-gradient-to-r ${confidenceToneClass}`}
                      style={{ width: `${confidenceValue ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-200">
                    {confidenceValue !== null
                      ? `${confidenceValue}% confidence`
                      : "Confidence unavailable"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/15 bg-slate-950/30 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-200/90">
                  Recommended Next Action
                </p>
                <p className="mt-1 text-sm text-slate-100">
                  {recommendationText}
                </p>
              </div>

              {readiness.reasons.length > 0 ? (
                <div className="mt-2 rounded-xl border border-white/12 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    Primary Signal
                  </p>
                  <p className="mt-1 text-xs text-slate-200">
                    {readiness.reasons[0]}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 xl:self-center">
              <div className="rounded-xl border border-white/15 bg-slate-950/30 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  Request Status
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {requestStatusLabel}
                </p>
              </div>

              <div className="rounded-xl border border-white/15 bg-slate-950/30 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  Request ID
                </p>
                <p className="mt-1 font-mono text-sm text-slate-200 break-all">
                  {request.id}
                </p>
              </div>

              <div className="rounded-xl border border-white/15 bg-slate-950/30 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  Tier
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {tierLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Document Progress"
        description="Current required document completion status."
      >
        <div className="space-y-2 text-sm text-slate-200">
          <p>Completion: {request.aiReadiness.docsCompleteness}%</p>
          <p>
            {request.requiredDocsPending > 0
              ? "Waiting on customer documents before execution can start."
              : "All required documents are submitted and ready for execution."}
          </p>

          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-cyan-200/90">
              Required Documents
            </p>

            {request.requirementItems.length > 0 ? (
              request.requirementItems.map((item, index) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-amber-300/35 bg-gradient-to-br from-amber-200/8 via-white/4 to-transparent"
                >
                  <div className="border-b border-amber-200/25 bg-amber-200/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-200/80">
                        Requirement {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="truncate text-sm font-semibold text-white">
                        {item.title}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 px-3 py-3">
                    {item.uploadedFiles.length > 0 ? (
                      <div className="space-y-1.5 pt-2 mb-2">
                        <p className="text-[10px] uppercase tracking-wide text-cyan-200/80">
                          File Submitted ({item.uploadedFiles.length})
                        </p>
                        {item.uploadedFiles.map((file) => (
                          <FileEvidenceRow
                            key={file.id}
                            fileName={file.fileName}
                            uploadedAt={file.uploadedAt}
                            signedUrl={file.signedUrl}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-amber-300/35 bg-amber-300/8 px-3 py-2 text-xs text-amber-200">
                        Pending upload.
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-300">
                No required document items are currently mapped to this request.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

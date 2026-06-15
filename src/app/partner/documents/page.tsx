"use client";

import type { Route } from "next";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PARTNER_UPLOAD_FILE_TYPES } from "@/constants/partner-upload-file-types";
import { getStreamDisplayName } from "@/constants/stream-display";
import { DocumentManager } from "@/features/documents/document-manager";
import { useAuth } from "@/hooks/use-auth";

type PartnerDocumentsDashboardPayload = {
  partner: {
    id: string;
    offeredServiceStream: string | null;
  };
  requests: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    packageStream?: string;
    requirementItems: Array<{
      id: string;
      title: string;
      uploadedFiles: Array<{
        id: string;
        fileName: string;
        uploadedAt: string;
        signedUrl: string | null;
      }>;
    }>;
  }>;
};

function normalizeStream(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  const cleaned = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleaned === "hr" || cleaned === "humanresources") {
    return "humanresources";
  }
  return cleaned;
}

function getCustomerInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CU";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default function PartnerDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading, isError } = useAuth();

  const userId = user?.id ?? "";

  const bucket =
    process.env.NEXT_PUBLIC_PARTNER_DOCUMENTS_BUCKET?.trim() ||
    "partner-documents";

  const customerDocsQuery = useQuery({
    queryKey: ["partner-customer-documents", userId],
    enabled: Boolean(user),
    queryFn: async (): Promise<PartnerDocumentsDashboardPayload> => {
      const response = await fetch("/api/partner/dashboard", { method: "GET" });
      const body = (await response.json().catch(() => null)) as
        | PartnerDocumentsDashboardPayload
        | { error?: string }
        | null;

      if (!response.ok || !body || !("requests" in body)) {
        throw new Error(
          (body && "error" in body && typeof body.error === "string"
            ? body.error
            : null) ?? "Could not load customer-submitted documents.",
        );
      }

      return body;
    },
  });

  const customerDocsByCustomer = useMemo(() => {
    const rows = (customerDocsQuery.data?.requests ?? []).flatMap((request) =>
      request.requirementItems.flatMap((requirementItem) =>
        requirementItem.uploadedFiles.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          uploadedAt: file.uploadedAt,
          signedUrl: file.signedUrl,
          organizationName: request.organizationName || request.organizationId,
          requirementTitle: requirementItem.title,
        })),
      ),
    );

    const sortedRows = rows.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    const grouped = new Map<string, typeof sortedRows>();
    sortedRows.forEach((row) => {
      const customerName = row.organizationName;
      const existing = grouped.get(customerName) ?? [];
      existing.push(row);
      grouped.set(customerName, existing);
    });

    return Array.from(grouped.entries())
      .map(([customerName, documents]) => ({ customerName, documents }))
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [customerDocsQuery.data?.requests]);

  const streamResolution = useMemo(() => {
    const partnerStream = normalizeStream(
      customerDocsQuery.data?.partner?.offeredServiceStream,
    );
    const rawPartnerStream =
      customerDocsQuery.data?.partner?.offeredServiceStream?.trim() ?? "";

    const requestStreams = new Set(
      (customerDocsQuery.data?.requests ?? [])
        .map((request) => normalizeStream(request.packageStream))
        .filter(Boolean),
    );

    const rawRequestStreams = Array.from(
      new Set(
        (customerDocsQuery.data?.requests ?? [])
          .map((request) => request.packageStream?.trim() ?? "")
          .filter(Boolean),
      ),
    );

    const byPartnerStream = partnerStream
      ? PARTNER_UPLOAD_FILE_TYPES.filter(
          (item) => normalizeStream(item.stream) === partnerStream,
        )
      : [];

    if (byPartnerStream.length > 0) {
      return {
        options: byPartnerStream,
        hasMissingMapping: false,
        rawPartnerStream,
        rawRequestStreams,
      };
    }

    const byRequestStreams =
      requestStreams.size > 0
        ? PARTNER_UPLOAD_FILE_TYPES.filter((item) =>
            requestStreams.has(normalizeStream(item.stream)),
          )
        : [];

    if (byRequestStreams.length > 0) {
      return {
        options: byRequestStreams,
        hasMissingMapping: false,
        rawPartnerStream,
        rawRequestStreams,
      };
    }

    const hasStreamSignals = Boolean(partnerStream) || requestStreams.size > 0;

    return {
      options: hasStreamSignals ? [] : PARTNER_UPLOAD_FILE_TYPES,
      hasMissingMapping: hasStreamSignals,
      rawPartnerStream,
      rawRequestStreams,
    };
  }, [customerDocsQuery.data]);

  const missingDocumentKeys = useMemo(() => {
    const raw = searchParams.get("missing") ?? "";
    if (!raw) {
      return [];
    }

    return Array.from(
      new Set(
        raw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }, [searchParams]);

  const retryCompleteId = searchParams.get("retryCompleteId") ?? "";
  const shouldRetryComplete = searchParams.get("retryComplete") === "1";

  const prioritizedDocumentTypeOptions = useMemo(() => {
    if (missingDocumentKeys.length === 0) {
      return streamResolution.options;
    }

    const missingSet = new Set(missingDocumentKeys);
    const missingFirst = streamResolution.options
      .filter((item) => missingSet.has(item.key))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (missingFirst.length > 0) {
      return missingFirst;
    }

    return streamResolution.options;
  }, [streamResolution.options, missingDocumentKeys]);

  const missingDocumentLabels = useMemo(() => {
    if (missingDocumentKeys.length === 0) {
      return [];
    }

    const labelByKey = new Map(
      PARTNER_UPLOAD_FILE_TYPES.map((item) => [item.key, item.label]),
    );

    return missingDocumentKeys.map((key) => labelByKey.get(key) ?? key);
  }, [missingDocumentKeys]);

  const resolvedPartnerId = customerDocsQuery.data?.partner?.id ?? "";
  const canUploadForPartner = Boolean(resolvedPartnerId);
  const shouldBlockUploadsForMissingStream =
    streamResolution.hasMissingMapping &&
    prioritizedDocumentTypeOptions.length === 0;
  const prefix = canUploadForPartner ? `partners/${resolvedPartnerId}` : "";

  return (
    <div className="space-y-6">
      {isLoading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Loading documents...
        </p>
      ) : null}

      {isError || !user ? (
        <p className="text-sm text-red-300">
          Could not load your document workspace right now.
        </p>
      ) : null}

      {user ? (
        <>
          <Card
            title="Customer Submitted Documents"
            description="Documents uploaded by customers for your assigned requests, grouped by customer."
          >
            {missingDocumentLabels.length > 0 ? (
              <div className="mb-3 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-100">
                  Missing Required Documents
                </p>
                <p className="mt-1 text-xs text-slate-800 dark:text-slate-50/95">
                  Upload these first to complete work order:{" "}
                  {missingDocumentLabels.join(", ")}.
                </p>
                {shouldRetryComplete ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      className="h-8 rounded-md bg-amber-300/90 px-3 text-xs font-semibold text-slate-950 hover:bg-amber-200"
                      onClick={() => {
                        const query = new URLSearchParams();
                        if (retryCompleteId) {
                          query.set("retryComplete", "1");
                          query.set("retryCompleteId", retryCompleteId);
                        }

                        const target = `/partner/work-orders${query.toString() ? `?${query.toString()}` : ""}`;
                        router.push(target as Route);
                      }}
                    >
                      Return And Finalize Work Order
                    </Button>
                    <p className="mt-1 text-[11px] text-slate-800 dark:text-slate-50/90">
                      After upload, click here to auto-complete and trigger
                      delivery/SLA updates.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {customerDocsQuery.isLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Loading customer documents...
              </p>
            ) : null}

            {customerDocsQuery.isError ? (
              <p className="text-sm text-red-300">
                {customerDocsQuery.error instanceof Error
                  ? customerDocsQuery.error.message
                  : "Could not load customer-submitted documents."}
              </p>
            ) : null}

            {!customerDocsQuery.isLoading &&
            !customerDocsQuery.isError &&
            customerDocsByCustomer.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No customer-submitted documents available yet.
              </p>
            ) : null}

            <div className="mt-2 space-y-3">
              {customerDocsByCustomer.map((group) => (
                <section
                  key={group.customerName}
                  className="relative overflow-hidden rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-4"
                >
                  <div className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-cyan-200/15 blur-xl" />
                  <div className="pointer-events-none absolute -bottom-8 left-10 h-16 w-16 rounded-full bg-sky-200/10 blur-xl" />

                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200/20 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-100/30 bg-cyan-100/15 text-xs font-semibold text-cyan-50">
                        {getCustomerInitials(group.customerName)}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {group.customerName}
                      </p>
                    </div>
                    <p className="text-xs text-cyan-700 dark:text-cyan-100/90">
                      {group.documents.length} file
                      {group.documents.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {group.documents.map((doc) => (
                      <article
                        key={doc.id}
                        className="rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="mt-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300/90" />
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {doc.fileName}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              Requirement: {doc.requirementTitle}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Uploaded{" "}
                              {new Date(doc.uploadedAt).toLocaleString()}
                            </p>
                          </div>
                          {doc.signedUrl ? (
                            <a
                              href={doc.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button variant="ghost">Open</Button>
                            </a>
                          ) : (
                            <Button variant="ghost" disabled>
                              Open unavailable
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Card>

          {canUploadForPartner && shouldBlockUploadsForMissingStream ? (
            <Card
              title="Partner Workspace Documents"
              description="Files your partner team uploads for delivery and reporting."
            >
              <div className="rounded-xl border border-amber-300/35 bg-amber-300/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-100">
                  Upload Mapping Needed
                </p>
                <p className="mt-2 text-sm text-slate-800 dark:text-slate-50/95">
                  Uploads are currently blocked because this stream has no
                  mapped partner document types.
                </p>
                <p className="mt-2 text-xs text-slate-800 dark:text-slate-50/90">
                  Partner stream:{" "}
                  {getStreamDisplayName(
                    streamResolution.rawPartnerStream || "Unknown Stream",
                  )}
                </p>
                {streamResolution.rawRequestStreams.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-800 dark:text-slate-50/90">
                    Request streams:{" "}
                    {streamResolution.rawRequestStreams
                      .map((stream) => getStreamDisplayName(stream))
                      .join(", ")}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-slate-800 dark:text-slate-50/90">
                  Next action: add matching entries in PARTNER_UPLOAD_FILE_TYPES
                  so this workspace can accept uploads.
                </p>
              </div>
            </Card>
          ) : null}

          {canUploadForPartner && !shouldBlockUploadsForMissingStream ? (
            <DocumentManager
              title="Partner Workspace Documents"
              description="Files your partner team uploads for delivery and reporting."
              bucket={bucket}
              prefix={prefix}
              acceptedFileTypes="application/pdf,image/*"
              uploadHint="Accepted formats: PDF and images (JPG, PNG, HEIC, WebP)."
              documentTypeOptions={prioritizedDocumentTypeOptions.map(
                (item) => ({
                  value: item.key,
                  label: item.label,
                  group: getStreamDisplayName(item.stream),
                }),
              )}
            />
          ) : null}

          {!canUploadForPartner ? (
            <Card
              title="Partner Workspace Documents"
              description="Files your partner team uploads for delivery and reporting."
            >
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Resolving partner workspace...
              </p>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

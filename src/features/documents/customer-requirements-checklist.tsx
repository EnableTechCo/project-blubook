"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import {
  listCustomerRequirementsPage,
  type CustomerRequirementItem,
  type RequirementStatus,
  type CustomerRequirementsPage,
} from "@/services/requirements.service";
import requirementsService from "@/services/requirements.service";

function statusTone(status: CustomerRequirementItem["status"]) {
  if (status === "approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200";
  }
  if (status === "submitted") {
    return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-500/20 dark:text-sky-200";
  }
  if (status === "rejected") {
    return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/20 dark:text-rose-200";
  }
  return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-slate-200";
}

export function CustomerRequirementsChecklist({
  organizationId,
  bucket,
  prefix,
  onToggleUploadPanel,
  isUploadPanelOpen = false,
  uploadPanel,
}: {
  organizationId: string;
  bucket: string;
  prefix: string;
  onToggleUploadPanel?: () => void;
  isUploadPanelOpen?: boolean;
  uploadPanel?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [uploadingRequirementId, setUploadingRequirementId] = useState<
    string | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const pageSize = 10;

  const [openSections, setOpenSections] = useState<
    Record<RequirementStatus, boolean>
  >({
    missing: false,
    submitted: false,
    approved: false,
    rejected: false,
  });
  const [sectionPage, setSectionPage] = useState<
    Record<RequirementStatus, number>
  >({
    missing: 1,
    submitted: 1,
    approved: 1,
    rejected: 1,
  });

  const sectionMeta = useMemo(
    () => [
      {
        status: "missing" as const,
        label: "Missing",
        barClass: "bg-amber-300",
      },
      {
        status: "submitted" as const,
        label: "Submitted",
        barClass: "bg-sky-300",
      },
      {
        status: "approved" as const,
        label: "Approved",
        barClass: "bg-emerald-300",
      },
      {
        status: "rejected" as const,
        label: "Rejected",
        barClass: "bg-rose-300",
      },
    ],
    [],
  );

  const sectionQueries = useQueries({
    queries: sectionMeta.map((section) => ({
      queryKey: [
        "customer-requirements",
        organizationId,
        section.status,
        sectionPage[section.status],
        pageSize,
      ],
      queryFn: () =>
        listCustomerRequirementsPage({
          organizationId,
          status: section.status,
          page: sectionPage[section.status],
          pageSize,
        }),
      enabled: Boolean(organizationId),
      placeholderData: (previousData: CustomerRequirementsPage | undefined) =>
        previousData,
    })),
  });

  const submitEvidenceMutation = useMutation({
    mutationFn: requirementsService.submitRequirementEvidence,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customer-requirements", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["documents", bucket, prefix],
        }),
      ]);
    },
  });

  const onRequirementFileChange = async (
    requirementItemId: string,
    files: File[],
  ) => {
    const file = files[0];
    if (!file) {
      return;
    }

    setUploadingRequirementId(requirementItemId);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await submitEvidenceMutation.mutateAsync({
        requirementItemId,
        bucket,
        prefix,
        file,
      });
      setUploadSuccess(`File uploaded: ${file.name}.`);
    } catch (error) {
      setUploadSuccess(null);
      setUploadError(
        error instanceof Error ? error.message : "Could not submit evidence.",
      );
    } finally {
      setUploadingRequirementId(null);
    }
  };

  const queryByStatus = useMemo(
    () =>
      Object.fromEntries(
        sectionMeta.map((section, index) => [
          section.status,
          sectionQueries[index],
        ]),
      ) as Record<RequirementStatus, (typeof sectionQueries)[number]>,
    [sectionMeta, sectionQueries],
  );

  const summary = useMemo(() => {
    const missing = queryByStatus.missing?.data?.pagination.total ?? 0;
    const submitted = queryByStatus.submitted?.data?.pagination.total ?? 0;
    const approved = queryByStatus.approved?.data?.pagination.total ?? 0;
    const rejected = queryByStatus.rejected?.data?.pagination.total ?? 0;

    const totals = {
      total: missing + submitted + approved + rejected,
      missing,
      submitted,
      approved,
      rejected,
    };

    return totals;
  }, [queryByStatus]);

  const summaryStats = useMemo(() => {
    const total = summary.total;
    const percentOfTotal = (count: number, isTotal = false) => {
      if (total === 0) {
        return 0;
      }

      if (isTotal) {
        return 100;
      }

      return Math.round((count / total) * 100);
    };

    return [
      {
        label: "Total",
        count: summary.total,
        percent: percentOfTotal(summary.total, true),
        barClass: "bg-slate-300",
      },
      {
        label: "Missing",
        count: summary.missing,
        percent: percentOfTotal(summary.missing),
        barClass: "bg-amber-300",
      },
      {
        label: "Submitted",
        count: summary.submitted,
        percent: percentOfTotal(summary.submitted),
        barClass: "bg-sky-300",
      },
      {
        label: "Approved",
        count: summary.approved,
        percent: percentOfTotal(summary.approved),
        barClass: "bg-emerald-300",
      },
      {
        label: "Rejected",
        count: summary.rejected,
        percent: percentOfTotal(summary.rejected),
        barClass: "bg-rose-300",
      },
    ];
  }, [summary]);

  const isAnySectionLoading = sectionQueries.some((query) => query.isLoading);
  const isAnySectionError = sectionQueries.some((query) => query.isError);

  return (
    <Card
      title="Requirements Checklist"
      description="Customer requirements generated from your selected package services and provider rules."
    >
      {onToggleUploadPanel ? (
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            onClick={onToggleUploadPanel}
            className="inline-flex items-center gap-2"
          >
            Upload
            {isUploadPanelOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      ) : null}

      {isUploadPanelOpen && uploadPanel ? (
        <div className="mb-5">{uploadPanel}</div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                {stat.label}
              </p>
              <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
                {stat.count}
              </p>
            </div>
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${stat.barClass}`}
                  style={{ width: `${stat.percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-light text-slate-500 dark:text-slate-300">
                {stat.percent}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {isAnySectionLoading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Loading requirements...
        </p>
      ) : null}

      {isAnySectionError ? (
        <p className="text-sm text-red-700 dark:text-red-300">
          Could not load requirements right now.
        </p>
      ) : null}

      {uploadError ? (
        <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
      ) : null}
      {uploadSuccess ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {uploadSuccess} View uploaded files in{" "}
          <Link
            href="/customer/documents"
            className="underline text-cyan-700 dark:text-cyan-300"
          >
            Documents
          </Link>
          .
        </p>
      ) : null}

      <div className="space-y-3">
        {sectionMeta.map((section) => {
          const query = queryByStatus[section.status];
          const items = query.data?.items ?? [];
          const pagination = query.data?.pagination;
          const isOpen = openSections[section.status];

          return (
            <section
              key={section.status}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-white/5"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() =>
                  setOpenSections((current) => ({
                    ...current,
                    [section.status]: !current[section.status],
                  }))
                }
                aria-expanded={isOpen}
              >
                <div className="flex w-44 shrink-0 items-center gap-2">
                  <p className="w-24 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {section.label}
                  </p>
                  <Badge className="w-10 justify-center border-amber-500 bg-amber-500 tabular-nums text-center text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-900">
                    {pagination?.total ?? 0}
                  </Badge>
                </div>

                <span className="ml-auto inline-flex w-24 items-center justify-end gap-1 text-xs text-slate-500 dark:text-slate-400">
                  {isOpen ? "Collapse" : "Expand"}
                  {isOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
              </button>

              {isOpen ? (
                <div className="space-y-3 border-t border-slate-200 px-4 py-4 dark:border-white/10">
                  {query.isLoading ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Loading {section.label.toLowerCase()} requirements...
                    </p>
                  ) : null}

                  {query.isError ? (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Could not load {section.label.toLowerCase()} requirements.
                    </p>
                  ) : null}

                  {!query.isLoading && !query.isError && items.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      No {section.label.toLowerCase()} requirements.
                    </p>
                  ) : null}

                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/15 dark:bg-white/5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <Badge className={statusTone(item.status)}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {item.packageStream}
                        {item.providerName ? ` • ${item.providerName}` : ""}
                        {item.isRequired ? " • Required" : " • Optional"}
                      </p>
                      {item.description ? (
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/90">
                          {item.description}
                        </p>
                      ) : null}
                      {item.whyRequired ? (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          Why: {item.whyRequired}
                        </p>
                      ) : null}
                      {item.statusReason ? (
                        <p className="mt-1 text-xs text-rose-700 dark:text-rose-200">
                          Reason: {item.statusReason}
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <FileUploader
                          buttonLabel={
                            uploadingRequirementId === item.id
                              ? "Uploading..."
                              : "Upload evidence"
                          }
                          onFilesSelected={(files) =>
                            onRequirementFileChange(item.id, files)
                          }
                          disabled={
                            submittingStates.has(item.status) ||
                            uploadingRequirementId === item.id
                          }
                          variant="primary"
                          className="min-w-36"
                        />
                      </div>
                    </article>
                  ))}

                  {pagination ? (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Page {pagination.page} of {pagination.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!pagination.hasPrevPage}
                          onClick={() =>
                            setSectionPage((current) => ({
                              ...current,
                              [section.status]: Math.max(
                                1,
                                current[section.status] - 1,
                              ),
                            }))
                          }
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!pagination.hasNextPage}
                          onClick={() =>
                            setSectionPage((current) => ({
                              ...current,
                              [section.status]: current[section.status] + 1,
                            }))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </Card>
  );
}

const submittingStates = new Set<CustomerRequirementItem["status"]>([
  "submitted",
  "approved",
]);

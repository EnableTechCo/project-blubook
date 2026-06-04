"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  listCustomerRequirements,
  type CustomerRequirementItem,
} from "@/services/requirements.service";
import requirementsService from "@/services/requirements.service";

function statusTone(status: CustomerRequirementItem["status"]) {
  if (status === "approved") {
    return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
  }
  if (status === "submitted") {
    return "bg-sky-500/20 text-sky-200 border-sky-400/40";
  }
  if (status === "rejected") {
    return "bg-rose-500/20 text-rose-200 border-rose-400/40";
  }
  return "bg-amber-500/20 text-amber-200 border-amber-400/40";
}

export function CustomerRequirementsChecklist({
  organizationId,
  bucket,
  prefix,
}: {
  organizationId: string;
  bucket: string;
  prefix: string;
}) {
  const queryClient = useQueryClient();
  const [uploadingRequirementId, setUploadingRequirementId] = useState<
    string | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const requirementsQuery = useQuery({
    queryKey: ["customer-requirements", organizationId],
    queryFn: () => listCustomerRequirements(organizationId),
    enabled: Boolean(organizationId),
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
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingRequirementId(requirementItemId);
    setUploadError(null);

    try {
      await submitEvidenceMutation.mutateAsync({
        requirementItemId,
        bucket,
        prefix,
        file,
      });
      event.target.value = "";
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Could not submit evidence.",
      );
    } finally {
      setUploadingRequirementId(null);
    }
  };

  const summary = useMemo(() => {
    const rows = requirementsQuery.data ?? [];
    const totals = {
      total: rows.length,
      missing: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
    };

    for (const item of rows) {
      totals[item.status] += 1;
    }

    return totals;
  }, [requirementsQuery.data]);

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
        ringClass: "border-slate-200/60 text-slate-100",
        barClass: "bg-slate-300",
      },
      {
        label: "Missing",
        count: summary.missing,
        percent: percentOfTotal(summary.missing),
        ringClass: "border-amber-300/70 text-amber-200",
        barClass: "bg-amber-300",
      },
      {
        label: "Submitted",
        count: summary.submitted,
        percent: percentOfTotal(summary.submitted),
        ringClass: "border-sky-300/70 text-sky-200",
        barClass: "bg-sky-300",
      },
      {
        label: "Approved",
        count: summary.approved,
        percent: percentOfTotal(summary.approved),
        ringClass: "border-emerald-300/70 text-emerald-200",
        barClass: "bg-emerald-300",
      },
      {
        label: "Rejected",
        count: summary.rejected,
        percent: percentOfTotal(summary.rejected),
        ringClass: "border-rose-300/70 text-rose-200",
        barClass: "bg-rose-300",
      },
    ];
  }, [summary]);

  return (
    <Card
      title="Requirements Checklist"
      description="Customer requirements generated from your selected package services and provider rules."
    >
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-slate-300">
              {stat.label}
            </p>
            <div className="mt-2 flex justify-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-transparent text-base font-semibold ${stat.ringClass}`}
              >
                {stat.count}
              </div>
            </div>
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${stat.barClass}`}
                  style={{ width: `${stat.percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-light text-slate-300">
                {stat.percent}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {requirementsQuery.isLoading ? (
        <p className="text-sm text-slate-300">Loading requirements...</p>
      ) : null}

      {requirementsQuery.isError ? (
        <p className="text-sm text-red-300">
          Could not load requirements right now.
        </p>
      ) : null}

      {uploadError ? (
        <p className="text-sm text-red-300">{uploadError}</p>
      ) : null}

      <div className="space-y-3">
        {(requirementsQuery.data ?? []).map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-white/15 bg-white/5 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <Badge className={statusTone(item.status)}>{item.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              {item.packageStream}
              {item.providerName ? ` • ${item.providerName}` : ""}
              {item.isRequired ? " • Required" : " • Optional"}
            </p>
            {item.description ? (
              <p className="mt-2 text-sm text-slate-200/90">
                {item.description}
              </p>
            ) : null}
            {item.whyRequired ? (
              <p className="mt-1 text-xs text-slate-300">
                Why: {item.whyRequired}
              </p>
            ) : null}
            {item.statusReason ? (
              <p className="mt-1 text-xs text-rose-200">
                Reason: {item.statusReason}
              </p>
            ) : null}
            <div className="mt-3">
              <label className="inline-flex cursor-pointer">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={
                    submittingStates.has(item.status) ||
                    uploadingRequirementId === item.id
                  }
                  // asChild prop removed as it is unsupported
                >
                  {uploadingRequirementId === item.id
                    ? "Uploading..."
                    : "Upload evidence"}
                </Button>
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => onRequirementFileChange(item.id, event)}
                  disabled={
                    submittingStates.has(item.status) ||
                    uploadingRequirementId === item.id
                  }
                />
              </label>
            </div>
          </article>
        ))}

        {!requirementsQuery.isLoading &&
        (requirementsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-300">
            No requirements generated yet. Complete onboarding and package setup
            to populate this list.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

const submittingStates = new Set<CustomerRequirementItem["status"]>([
  "submitted",
  "approved",
]);

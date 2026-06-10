"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { useCustomerContext } from "@/hooks/use-customer-context";
import { listCustomerRequirements } from "@/services/requirements.service";
import requirementsService from "@/services/requirements.service";

function isPendingRequirement(status: string) {
  return status === "missing" || status === "rejected";
}

function isPurchaseOrderRequirement(input: {
  title: string;
  evidenceType: string;
}) {
  const title = input.title.toLowerCase();
  const evidenceType = input.evidenceType.toLowerCase();
  return (
    title.includes("purchase order") ||
    title.includes("purchase-order") ||
    evidenceType.includes("purchase_order") ||
    (evidenceType.includes("purchase") && evidenceType.includes("order"))
  );
}

export default function CustomerDashboardPage() {
  const queryClient = useQueryClient();
  const customerContext = useCustomerContext();
  const [uploadingRequirementId, setUploadingRequirementId] = useState<
    string | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const organizationId = customerContext.data?.organizationId ?? "";
  const userId = customerContext.data?.userId ?? "";
  const bucket =
    process.env.NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET?.trim() || "documents";
  const prefix = `organizations/${organizationId}/customers/${userId}`;

  const requirementsQuery = useQuery({
    queryKey: ["customer-requirements", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listCustomerRequirements(organizationId),
  });

  const submitEvidenceMutation = useMutation({
    mutationFn: requirementsService.submitRequirementEvidence,
    onSuccess: async () => {
      setUploadError(null);
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

  const ensurePoRequirementMutation = useMutation({
    mutationFn: requirementsService.ensurePurchaseOrderRequirement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["customer-requirements", organizationId],
      });
    },
  });

  const pendingPurchaseOrders = (requirementsQuery.data ?? []).filter(
    (item) =>
      item.isRequired &&
      isPendingRequirement(item.status) &&
      isPurchaseOrderRequirement({
        title: item.title,
        evidenceType: item.evidenceType,
      }),
  );

  async function onPurchaseOrderFileChange(
    requirementItemId: string,
    files: File[],
  ) {
    const file = files[0];
    if (!file) {
      return;
    }

    setUploadingRequirementId(requirementItemId);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const result = await submitEvidenceMutation.mutateAsync({
        requirementItemId,
        bucket,
        prefix,
        file,
      });

      const kickoffOrderId = result.kickoff?.salesOrderId ?? null;
      const kickoffPoReference = result.kickoff?.poReference ?? null;
      const kickoffSkipped = result.kickoff?.skipped === true;

      if (kickoffOrderId || kickoffPoReference) {
        setUploadSuccess(
          `Purchase Order uploaded: ${file.name}. Workflow started for ${kickoffPoReference ?? "PO"}${kickoffOrderId ? ` (Order ${kickoffOrderId})` : ""}.`,
        );
      } else if (kickoffSkipped) {
        setUploadSuccess(
          `Purchase Order uploaded: ${file.name}. Requirement was updated successfully.`,
        );
      } else {
        setUploadSuccess(
          `Purchase Order uploaded: ${file.name}. Workflow kickoff is processing.`,
        );
      }
    } catch (error) {
      setUploadSuccess(null);
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not upload purchase order.",
      );
    } finally {
      setUploadingRequirementId(null);
    }
  }

  async function onPurchaseOrderFileChangeWithEnsure(files: File[]) {
    const file = files[0];
    if (!file) {
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);

    try {
      const result = await ensurePoRequirementMutation.mutateAsync();
      await onPurchaseOrderFileChange(result.requirementId, [file]);
    } catch (error) {
      setUploadSuccess(null);
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not prepare purchase order upload.",
      );
    }
  }

  if (customerContext.isLoading) {
    return <DashboardLoadingSkeleton metricCount={4} listCount={3} />;
  }

  if (customerContext.isError || !customerContext.data) {
    return <DashboardLoadingSkeleton metricCount={4} listCount={3} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Customer Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Submit Purchase Orders and track execution from one place.
          </p>
        </div>
        <Badge>{pendingPurchaseOrders.length} PO Pending</Badge>
      </div>

      <Card
        title="Purchase Order Upload"
        description="Upload PO files here. This is separate from requested supporting documents."
      >
        {requirementsQuery.isLoading ? (
          <p className="text-sm text-slate-300">Loading PO requirements...</p>
        ) : requirementsQuery.isError ? (
          <p className="text-sm text-red-300">
            Could not load PO requirements.
          </p>
        ) : pendingPurchaseOrders.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              No pending purchase orders right now.
            </p>
            <div className="inline-flex">
              <FileUploader
                buttonLabel={
                  ensurePoRequirementMutation.isPending
                    ? "Preparing PO upload..."
                    : "Upload Purchase Order"
                }
                disabled={
                  ensurePoRequirementMutation.isPending ||
                  submitEvidenceMutation.isPending
                }
                onFilesSelected={(files) =>
                  void onPurchaseOrderFileChangeWithEnsure(files)
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pendingPurchaseOrders.map((item) => (
              <div key={item.id} className="inline-flex">
                <FileUploader
                  buttonLabel={
                    uploadingRequirementId === item.id
                      ? `Uploading ${item.title}...`
                      : `Upload ${item.title}`
                  }
                  disabled={uploadingRequirementId === item.id}
                  onFilesSelected={(files) =>
                    void onPurchaseOrderFileChange(item.id, files)
                  }
                />
              </div>
            ))}
          </div>
        )}

        {uploadError ? (
          <p className="mt-3 text-sm text-red-300">{uploadError}</p>
        ) : null}
        {uploadSuccess ? (
          <p className="mt-3 text-sm text-emerald-300">{uploadSuccess}</p>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/customer/requests" className="inline-flex">
          <Button variant="ghost">Open Requests</Button>
        </Link>
        <Link href="/customer/documents" className="inline-flex">
          <Button variant="ghost">Open Documents</Button>
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { getStreamDisplayName } from "@/constants/stream-display";
import { useCustomerContext } from "@/hooks/use-customer-context";
import { useCustomerJourneyStore } from "@/store/customer-journey-store";
import {
  listRequestMessages,
  sendRequestMessage,
} from "@/services/messages.service";
import { getCustomerRequestById } from "@/services/requests.service";
import { listCustomerRequirements } from "@/services/requirements.service";
import requirementsService from "@/services/requirements.service";

type ProviderRequestContext = {
  packageStream: string;
  providerName: string;
};

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

function parseProviderRequestContext(
  title: string,
): ProviderRequestContext | null {
  const prefix = "Provider onboarding request - ";
  if (!title.startsWith(prefix)) {
    return null;
  }

  const content = title.slice(prefix.length);
  const separator = content.lastIndexOf(" - ");
  if (separator <= 0 || separator >= content.length - 3) {
    return null;
  }

  const packageStream = content.slice(0, separator).trim();
  const providerName = content.slice(separator + 3).trim();

  if (!packageStream || !providerName) {
    return null;
  }

  return { packageStream, providerName };
}

function isProviderOnboardingRequest(
  title: string,
  description: string | null,
) {
  return (
    title.startsWith("Provider onboarding request -") ||
    (description?.startsWith("Auto-generated provider request") ?? false)
  );
}

function getCustomerFacingDescription(input: {
  title: string;
  description: string | null;
}) {
  if (isProviderOnboardingRequest(input.title, input.description)) {
    return "Upload the requested documents to start this service and activate SLA timelines.";
  }

  return input.description || "No description";
}

function getCustomerFacingTitle(input: {
  title: string;
  description: string | null;
}) {
  if (!isProviderOnboardingRequest(input.title, input.description)) {
    return input.title;
  }

  const providerContext = parseProviderRequestContext(input.title);
  if (!providerContext) {
    return "Service onboarding request";
  }

  return `${getStreamDisplayName(providerContext.packageStream)} onboarding request`;
}

function getRequirementStatusMicrocopy(status: string, reason: string | null) {
  if (status === "submitted") {
    return "Waiting for partner review";
  }

  if (status === "approved") {
    return "Accepted by partner";
  }

  if (status === "rejected") {
    return reason?.trim()
      ? `Changes requested - see reason: ${reason}`
      : "Changes requested - see reason";
  }

  return "Upload required document to continue";
}

function getDisplayStatusLabel(input: {
  title: string;
  description: string | null;
  status: string;
  hasPendingRequirements?: boolean;
}) {
  if (
    input.status === "submitted" &&
    isProviderOnboardingRequest(input.title, input.description)
  ) {
    return input.hasPendingRequirements
      ? "Documents Required"
      : "Request In Progress";
  }

  return formatStatusLabel(input.status);
}

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

export default function CustomerRequestDetailPage() {
  const queryClient = useQueryClient();
  const customerContext = useCustomerContext();
  const markSuiteRequestViewed = useCustomerJourneyStore(
    (state) => state.markSuiteRequestViewed,
  );
  const params = useParams<{ id: string }>();
  const requestId = params?.id ?? "";
  const [messageBody, setMessageBody] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadingRequirementId, setUploadingRequirementId] = useState<
    string | null
  >(null);
  const [isInitialBootstrapped, setIsInitialBootstrapped] = useState(false);

  const requestQuery = useQuery({
    queryKey: ["customer-request", customerContext.data?.userId, requestId],
    enabled: Boolean(customerContext.data?.userId && requestId),
    queryFn: () =>
      getCustomerRequestById({
        customerId: customerContext.data!.userId,
        requestId,
      }),
  });

  const messagesQuery = useQuery({
    queryKey: ["request-messages", requestId],
    enabled: Boolean(requestId),
    queryFn: () => listRequestMessages(requestId),
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendRequestMessage,
    onSuccess: async () => {
      setMessageBody("");
      setMessageError(null);
      await queryClient.invalidateQueries({
        queryKey: ["request-messages", requestId],
      });
    },
    onError: (error) => {
      setMessageError(
        error instanceof Error ? error.message : "Could not send message.",
      );
    },
  });

  const onSubmitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerContext.data?.userId || !messageBody.trim()) {
      return;
    }

    sendMessageMutation.mutate({
      requestId,
      senderId: customerContext.data.userId,
      body: messageBody.trim(),
    });
  };

  const userId = customerContext.data?.userId ?? "";
  const fallbackOrganizationId = customerContext.data?.organizationId ?? "";
  const bucket =
    process.env.NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET?.trim() || "documents";
  const request = requestQuery.data ?? null;
  const organizationId = request?.organization_id ?? fallbackOrganizationId;
  const prefix = `organizations/${organizationId}/customers/${userId}`;
  const providerContext = request
    ? parseProviderRequestContext(request.title)
    : null;

  const requirementsQuery = useQuery({
    queryKey: [
      "request-requirements",
      organizationId,
      requestId,
      providerContext?.packageStream,
      providerContext?.providerName,
    ],
    enabled: Boolean(organizationId && request),
    queryFn: () => listCustomerRequirements(organizationId),
  });

  const submitEvidenceMutation = useMutation({
    mutationFn: requirementsService.submitRequirementEvidence,
    onSuccess: async () => {
      setUploadError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["request-requirements"] }),
        queryClient.invalidateQueries({
          queryKey: ["customer-requirements", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["documents", bucket, prefix],
        }),
      ]);
    },
  });

  const matchingRequirements = (requirementsQuery.data ?? []).filter((item) => {
    if (!item.isRequired) {
      return false;
    }

    if (!providerContext) {
      return isPendingRequirement(item.status);
    }

    const streamMatches = item.packageStream === providerContext.packageStream;
    const providerMatches =
      item.providerName === null ||
      item.providerName === providerContext.providerName;

    return streamMatches && providerMatches;
  });

  const pendingRequirements = matchingRequirements.filter((item) =>
    isPendingRequirement(item.status),
  );
  const pendingPurchaseOrderRequirements = pendingRequirements.filter((item) =>
    isPurchaseOrderRequirement({
      title: item.title,
      evidenceType: item.evidenceType,
    }),
  );
  const pendingDocumentRequirements = pendingRequirements.filter(
    (item) =>
      !isPurchaseOrderRequirement({
        title: item.title,
        evidenceType: item.evidenceType,
      }),
  );
  const totalRequiredFiles = matchingRequirements.length;
  const remainingRequiredFiles = pendingRequirements.length;
  const submittedRequiredFiles = Math.max(
    totalRequiredFiles - remainingRequiredFiles,
    0,
  );

  useEffect(() => {
    if (!requestId) {
      return;
    }

    markSuiteRequestViewed(requestId);
  }, [markSuiteRequestViewed, requestId]);

  const lastDebugSignatureRef = useRef<string>("");

  useEffect(() => {
    const requiredItems = (requirementsQuery.data ?? []).filter(
      (item) => item.isRequired,
    );
    const streamMatchedItems = providerContext
      ? requiredItems.filter(
          (item) => item.packageStream === providerContext.packageStream,
        )
      : requiredItems;
    const providerMatchedItems = providerContext
      ? streamMatchedItems.filter(
          (item) =>
            item.providerName === null ||
            item.providerName === providerContext.providerName,
        )
      : streamMatchedItems;

    const debugSignature = JSON.stringify({
      requestId,
      requestTitle: request?.title ?? null,
      organizationId,
      fallbackOrganizationId,
      providerContext,
      queryLoading: requirementsQuery.isLoading,
      queryError: requirementsQuery.isError,
      totalRequirements: requirementsQuery.data?.length ?? 0,
      requiredCount: requiredItems.length,
      streamMatchCount: streamMatchedItems.length,
      providerMatchCount: providerMatchedItems.length,
      pendingCount: pendingRequirements.length,
      firstFiveMatchingIds: providerMatchedItems
        .slice(0, 5)
        .map((item) => item.id),
    });

    if (lastDebugSignatureRef.current === debugSignature) {
      return;
    }
    lastDebugSignatureRef.current = debugSignature;

    console.log("[CustomerRequestDetail] diagnostic snapshot", {
      requestId,
      requestTitle: request?.title ?? null,
      organizationId,
      providerContext,
      requirementsQueryEnabled: Boolean(organizationId && request),
      requirementsQueryStatus: {
        isLoading: requirementsQuery.isLoading,
        isError: requirementsQuery.isError,
        count: requirementsQuery.data?.length ?? 0,
      },
      requiredCount: requiredItems.length,
      streamMatchCount: streamMatchedItems.length,
      providerMatchCount: providerMatchedItems.length,
      matchingRequirements: matchingRequirements.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        packageStream: item.packageStream,
        providerName: item.providerName,
        isRequired: item.isRequired,
      })),
      pendingRequirements: pendingRequirements.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
      })),
      mismatchSamples: requiredItems.slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        packageStream: item.packageStream,
        providerName: item.providerName,
        streamMatches: providerContext
          ? item.packageStream === providerContext.packageStream
          : true,
        providerMatches: providerContext
          ? item.providerName === null ||
            item.providerName === providerContext.providerName
          : true,
        pendingStatus: isPendingRequirement(item.status),
      })),
    });
  }, [
    requestId,
    request,
    request?.title,
    organizationId,
    fallbackOrganizationId,
    providerContext,
    requirementsQuery.isLoading,
    requirementsQuery.isError,
    requirementsQuery.data,
    matchingRequirements,
    pendingRequirements,
  ]);

  const isBootstrappingRequirements =
    Boolean(organizationId && request) &&
    (requirementsQuery.isLoading ||
      (!isInitialBootstrapped && requirementsQuery.isFetching));
  const isBootstrappingMessages =
    Boolean(requestId) &&
    (messagesQuery.isLoading ||
      (!isInitialBootstrapped && messagesQuery.isFetching));

  useEffect(() => {
    if (isInitialBootstrapped) {
      return;
    }

    const requestBootstrapReady =
      !customerContext.isLoading &&
      !requestQuery.isLoading &&
      !requestQuery.isFetching;

    const requirementsBootstrapReady =
      !Boolean(organizationId && request) || !isBootstrappingRequirements;
    const messagesBootstrapReady =
      !Boolean(requestId) || !isBootstrappingMessages;

    if (
      requestBootstrapReady &&
      requirementsBootstrapReady &&
      messagesBootstrapReady
    ) {
      setIsInitialBootstrapped(true);
    }
  }, [
    isInitialBootstrapped,
    customerContext.isLoading,
    requestQuery.isLoading,
    requestQuery.isFetching,
    organizationId,
    request,
    request?.id,
    requestId,
    isBootstrappingRequirements,
    isBootstrappingMessages,
  ]);

  if (
    !isInitialBootstrapped ||
    customerContext.isLoading ||
    requestQuery.isLoading ||
    isBootstrappingRequirements ||
    isBootstrappingMessages
  ) {
    return <DashboardLoadingSkeleton metricCount={3} listCount={2} />;
  }

  if (customerContext.isError || !customerContext.data) {
    return <DashboardLoadingSkeleton metricCount={3} listCount={2} />;
  }

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
        error instanceof Error
          ? error.message
          : "Could not upload requested file.",
      );
    } finally {
      setUploadingRequirementId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Request Detail
        </h2>
        {request ? (
          <Badge className="capitalize">
            {getDisplayStatusLabel({
              ...request,
              hasPendingRequirements: pendingRequirements.length > 0,
            })}
          </Badge>
        ) : null}
      </div>

      {request ? (
        <Card title="Request Overview">
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-100">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {getCustomerFacingTitle({
                title: request.title,
                description: request.description,
              })}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Badge className="capitalize">
                {getDisplayStatusLabel({
                  ...request,
                  hasPendingRequirements: pendingRequirements.length > 0,
                })}
              </Badge>
              <Badge className="uppercase">{request.priority}</Badge>
            </div>
            <p>
              {getCustomerFacingDescription({
                title: request.title,
                description: request.description,
              })}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Created: {new Date(request.created_at).toLocaleString()}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Submitted documents are stored in the Documents workspace.
            </p>
            {totalRequiredFiles > 0 ? (
              <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-3 text-xs text-emerald-800 dark:border-emerald-300/20 dark:text-emerald-100">
                <p>
                  {submittedRequiredFiles} file
                  {submittedRequiredFiles === 1 ? "" : "s"} uploaded.
                </p>
                <p className="mt-1">
                  {remainingRequiredFiles} file
                  {remainingRequiredFiles === 1 ? "" : "s"} pending.{" "}
                  {submittedRequiredFiles} out of {totalRequiredFiles} required
                  file{submittedRequiredFiles === 1 ? "" : "s"} uploaded to kick
                  off your SLA.
                </p>
              </div>
            ) : null}

            {matchingRequirements.length > 0 ? (
              <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  Requirement Status
                </p>
                <div className="mt-2 space-y-2">
                  {matchingRequirements.map((item) => (
                    <div
                      key={`status-${item.id}`}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/5"
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {getRequirementStatusMicrocopy(
                          item.status,
                          item.statusReason,
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {pendingPurchaseOrderRequirements.length > 0 ? (
                <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-100">
                    Purchase Order Upload
                  </p>
                  <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-100/85">
                    Upload your PO file here. This is handled separately from
                    other required documents.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pendingPurchaseOrderRequirements.map((item) => (
                      <div key={item.id} className="inline-flex">
                        <FileUploader
                          buttonLabel={
                            uploadingRequirementId === item.id
                              ? `Uploading...`
                              : `Upload`
                          }
                          disabled={uploadingRequirementId === item.id}
                          onFilesSelected={(files) =>
                            onRequirementFileChange(item.id, files)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {pendingDocumentRequirements.length > 0 ? (
                <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Requested Documents
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pendingDocumentRequirements.map((item) => (
                      <div key={item.id} className="inline-flex">
                        <FileUploader
                          buttonLabel={
                            uploadingRequirementId === item.id
                              ? `Uploading...`
                              : `Upload`
                          }
                          disabled={uploadingRequirementId === item.id}
                          onFilesSelected={(files) =>
                            onRequirementFileChange(item.id, files)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {pendingRequirements.length === 0 ? (
                <Badge className="capitalize">No pending required files</Badge>
              ) : null}
            </div>
            <Link href="/customer/documents" className="inline-flex">
              <Button variant="ghost">View submitted documents</Button>
            </Link>
            {uploadError ? (
              <p className="text-sm text-red-300">{uploadError}</p>
            ) : null}
            {uploadSuccess ? (
              <p className="text-sm text-emerald-300">
                {uploadSuccess} View uploaded files in{" "}
                <Link href="/customer/documents" className="underline">
                  Documents
                </Link>
                .
              </p>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card title="Request not found">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This request could not be loaded.
          </p>
        </Card>
      )}

      <Card title="Messages">
        <form className="space-y-3" onSubmit={onSubmitMessage}>
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-coral dark:border-white/20 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-300/60"
            placeholder="Ask a question or add an update"
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            maxLength={1000}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={!messageBody.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? "Sending..." : "Send message"}
            </Button>
            {messageError ? (
              <p className="text-sm text-red-300">{messageError}</p>
            ) : null}
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {messagesQuery.isLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Loading messages...
            </p>
          ) : messagesQuery.isError ? (
            <p className="text-sm text-red-300">
              Could not load request messages.
            </p>
          ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
            messagesQuery.data.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-white/15 dark:bg-white/5"
              >
                <p className="text-sm text-slate-900 dark:text-white">
                  {message.body}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {new Date(message.created_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No messages on this request yet.
            </p>
          )}
        </div>
      </Card>

      <div>
        <Link href="/customer/requests">
          <Button variant="ghost">Back to requests</Button>
        </Link>
      </div>
    </div>
  );
}

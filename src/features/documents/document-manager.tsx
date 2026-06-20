"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  File,
  FileText,
  Image,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import { SelectMenu } from "@/components/ui/select-menu";
import { DocumentViewerModal } from "@/components/ui/document-viewer-modal";
import {
  type CustomerGroupedDocumentsPayload,
  type DocumentGroupKey,
  createSignedDocumentUrl,
  type DocumentRecord,
  listCustomerDocumentsGrouped,
  listDocuments,
  removeDocument,
  uploadDocument,
} from "@/services/documents.service";

type LocalDocumentSeed = {
  path: string;
  name: string;
  size?: number;
  updatedAt?: string;
};

interface DocumentTypeOption {
  value: string;
  label: string;
  group?: string;
}

type LocalMockDocument = LocalDocumentSeed & {
  documentType?: string;
  documentTypeLabel?: string;
};

function formatSize(size?: number) {
  if (!size || size <= 0) {
    return "-";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentManager({
  title,
  description,
  bucket,
  prefix,
  mockDocuments,
  documentTypeOptions,
  groupingMode = "document-type",
  organizationId,
  showUploadSection = true,
  showDocumentsSection = true,
  hideWorkspaceHeader = false,
  showBucketBadge = true,
  acceptedFileTypes = "application/pdf,image/*",
  uploadHint = "Accepted formats: PDF and images (JPG, PNG, HEIC, WebP).",
}: {
  title: string;
  description: string;
  bucket: string;
  prefix: string;
  mockDocuments?: LocalDocumentSeed[];
  documentTypeOptions?: DocumentTypeOption[];
  groupingMode?: "document-type" | "admin-groups";
  organizationId?: string;
  showUploadSection?: boolean;
  showDocumentsSection?: boolean;
  hideWorkspaceHeader?: boolean;
  showBucketBadge?: boolean;
  acceptedFileTypes?: string;
  uploadHint?: string;
}) {
  const useMockData = Boolean(mockDocuments?.length);
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>(
    documentTypeOptions?.[0]?.value ?? "",
  );
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [selectedGroup, setSelectedGroup] = useState<"all" | DocumentGroupKey>(
    "all",
  );
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [openDocumentSections, setOpenDocumentSections] = useState<
    Record<string, boolean>
  >({});
  const [localDocs, setLocalDocs] = useState<LocalMockDocument[]>(
    mockDocuments ?? [],
  );
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<{
    fileName: string;
    url: string | null;
    mimeType?: string;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    fileName: string;
    bucket: string;
    path: string;
  } | null>(null);

  const queryKey = useMemo(
    () => [
      "documents",
      bucket,
      prefix,
      groupingMode,
      selectedGroup,
      page,
      pageSize,
    ],
    [bucket, prefix, groupingMode, selectedGroup, page, pageSize],
  );

  const groupedDocumentTypeOptions = useMemo(() => {
    const groups = new Map<string, DocumentTypeOption[]>();
    (documentTypeOptions ?? []).forEach((option) => {
      const groupLabel = option.group ?? "Other";
      const items = groups.get(groupLabel) ?? [];
      items.push(option);
      groups.set(groupLabel, items);
    });

    return Array.from(groups.entries())
      .map(([group, options]) => ({
        group,
        options: options.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }, [documentTypeOptions]);

  useEffect(() => {
    if (!documentTypeOptions?.length) {
      if (selectedDocumentType) {
        setSelectedDocumentType("");
      }
      return;
    }

    const selectedStillValid = documentTypeOptions.some(
      (option) => option.value === selectedDocumentType,
    );

    if (!selectedStillValid) {
      setSelectedDocumentType(documentTypeOptions[0]?.value ?? "");
    }
  }, [documentTypeOptions, selectedDocumentType]);

  const documentsQuery = useQuery<
    DocumentRecord[] | CustomerGroupedDocumentsPayload
  >({
    queryKey,
    queryFn: () => {
      if (groupingMode === "admin-groups" && organizationId) {
        return listCustomerDocumentsGrouped({
          organizationId,
          bucket,
          prefix,
          group: selectedGroup === "all" ? undefined : selectedGroup,
          page,
          pageSize,
        });
      }

      return listDocuments({ bucket, prefix });
    },
    enabled: !useMockData,
    placeholderData: (previousData) => previousData,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const openMutation = useMutation({
    mutationFn: createSignedDocumentUrl,
    onSuccess: (signedUrl) => {
      if (isViewerOpen && viewingFile) {
        setViewingFile((prev) => (prev ? { ...prev, url: signedUrl } : null));
      } else {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      }
    },
  });

  const downloadMutation = useMutation({
    mutationFn: createSignedDocumentUrl,
    onSuccess: (signedUrl) => {
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    },
  });

  const onFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) {
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);

    if (documentTypeOptions?.length && !selectedDocumentType) {
      setUploadError("Select a document type before uploading.");
      return;
    }

    const selectedType = documentTypeOptions?.find(
      (option) => option.value === selectedDocumentType,
    );

    const cleanedName = file.name.replace(/\s+/g, "-").toLowerCase();
    const typePathSegment = selectedType
      ? selectedType.value.replace(/[^a-z0-9\-]/gi, "-").toLowerCase()
      : null;
    const path = `${prefix}/${typePathSegment ? `${typePathSegment}/` : ""}${Date.now()}-${cleanedName}`;

    if (useMockData) {
      setLocalDocs((current) => [
        {
          path,
          name: file.name,
          size: file.size,
          updatedAt: new Date().toISOString(),
          documentType: selectedType?.value,
          documentTypeLabel: selectedType?.label,
        },
        ...current,
      ]);
      setUploadSuccess(
        selectedType
          ? `File uploaded: ${file.name} (${selectedType.label}).`
          : `File uploaded: ${file.name}.`,
      );
      console.info("[documents] upload success", {
        mode: "mock",
        bucket,
        path,
        fileName: file.name,
        sizeBytes: file.size,
        documentType: selectedType?.value,
      });
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        bucket,
        path,
        file,
        documentType: selectedType?.value,
        documentTypeLabel: selectedType?.label,
      });
      setUploadSuccess(
        selectedType
          ? `File uploaded: ${file.name} (${selectedType.label}).`
          : `File uploaded: ${file.name}.`,
      );
      console.info("[documents] upload success", {
        mode: "live",
        bucket,
        path,
        fileName: file.name,
        sizeBytes: file.size,
        documentType: selectedType?.value,
      });
    } catch (error) {
      setUploadSuccess(null);
      console.error("[documents] upload failed", {
        bucket,
        path,
        fileName: file.name,
        error,
      });
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const documentItems = useMemo<
    Array<
      Pick<
        DocumentRecord,
        "name" | "path" | "size" | "updatedAt" | "groupLabel"
      > & {
        documentType?: string;
        documentTypeLabel?: string;
        mimeType?: string;
      }
    >
  >(() => {
    if (useMockData) {
      return localDocs;
    }

    if (groupingMode === "admin-groups") {
      const payload =
        (documentsQuery.data as CustomerGroupedDocumentsPayload | undefined) ??
        null;
      return payload?.documents ?? [];
    }

    return (documentsQuery.data as DocumentRecord[] | undefined) ?? [];
  }, [useMockData, localDocs, documentsQuery.data, groupingMode]);

  const adminGroupFilters = useMemo(() => {
    if (groupingMode !== "admin-groups") {
      return null;
    }

    const payload =
      (documentsQuery.data as CustomerGroupedDocumentsPayload | undefined) ??
      null;

    return {
      total: payload?.metrics.total ?? 0,
      byGroup: payload?.metrics.byGroup ?? {
        "requirements-docs": 0,
        "service-request-docs": 0,
        "delivery-docs": 0,
        "purchase-orders": 0,
        "commercial-docs": 0,
        "compliance-docs": 0,
      },
      availableGroups: payload?.filters.availableGroups ?? [],
    };
  }, [documentsQuery.data, groupingMode]);

  const adminPagination = useMemo(() => {
    if (groupingMode !== "admin-groups") {
      return null;
    }

    const payload =
      (documentsQuery.data as CustomerGroupedDocumentsPayload | undefined) ??
      null;

    return (
      payload?.pagination ?? {
        page,
        pageSize,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      }
    );
  }, [documentsQuery.data, groupingMode, page, pageSize]);

  const groupedDocumentItems = useMemo(() => {
    const groups = new Map<string, typeof documentItems>();
    documentItems.forEach((doc) => {
      const key =
        groupingMode === "admin-groups"
          ? (doc.groupLabel ?? "Service Request Docs")
          : (doc.documentTypeLabel ?? doc.documentType ?? "Other Documents");
      const rows = groups.get(key) ?? [];
      rows.push(doc);
      groups.set(key, rows);
    });

    const adminGroupSortOrder = [
      "Requirements Docs",
      "Service Request Docs",
      "Delivery Docs",
      "Purchase Orders",
      "Commercial Docs",
      "Compliance Docs",
    ];

    const adminGroupRank = new Map(
      adminGroupSortOrder.map((group, idx) => [group, idx]),
    );

    return Array.from(groups.entries())
      .map(([group, docs]) => ({
        group,
        docs: docs.sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        }),
      }))
      .sort((a, b) => {
        if (groupingMode !== "admin-groups") {
          return a.group.localeCompare(b.group);
        }

        const rankA = adminGroupRank.get(a.group);
        const rankB = adminGroupRank.get(b.group);

        if (typeof rankA === "number" && typeof rankB === "number") {
          return rankA - rankB;
        }

        if (typeof rankA === "number") {
          return -1;
        }

        if (typeof rankB === "number") {
          return 1;
        }

        return a.group.localeCompare(b.group);
      });
  }, [documentItems, groupingMode]);

  useEffect(() => {
    if (groupingMode === "admin-groups") {
      return;
    }

    setOpenDocumentSections((current) => {
      const next: Record<string, boolean> = {};
      for (const group of groupedDocumentItems) {
        next[group.group] = current[group.group] ?? false;
      }
      return next;
    });
  }, [groupedDocumentItems, groupingMode]);

  return (
    <div className="space-y-6">
      {!hideWorkspaceHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>
          {showBucketBadge ? (
            <Badge className="uppercase">{bucket}</Badge>
          ) : null}
        </div>
      ) : null}

      {showUploadSection ? (
        <Card
          title="Upload"
          description="Upload and store files securely in your workspace."
        >
          {documentTypeOptions?.length ? (
            <div className="relative mb-4 overflow-hidden rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-300/25 dark:bg-slate-950/40">
              <div className="pointer-events-none absolute -right-6 -top-6 h-14 w-14 rounded-full bg-cyan-300/20 blur-xl" />
              <div className="pointer-events-none absolute -bottom-8 left-8 h-12 w-12 rounded-full bg-sky-300/20 blur-xl" />

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-100/90">
                Document type
              </label>

              <SelectMenu
                value={selectedDocumentType}
                onChange={(nextValue) => setSelectedDocumentType(nextValue)}
                disabled={uploadMutation.isPending}
                placeholder="Select document type"
                buttonClassName="border-cyan-300/60 bg-white text-slate-900 focus:ring-cyan-300/60 dark:border-cyan-200/30 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:ring-cyan-300/40"
                className="w-full"
                options={groupedDocumentTypeOptions.flatMap((group) =>
                  group.options.map((option) => ({
                    value: option.value,
                    label: option.label,
                    description: group.group,
                  })),
                )}
              />
            </div>
          ) : null}

          <FileUploader
            buttonLabel={
              uploadMutation.isPending ? "Uploading..." : "Choose file"
            }
            onFilesSelected={onFilesSelected}
            accept={acceptedFileTypes}
            disabled={uploadMutation.isPending}
            variant="ghost"
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
            {uploadHint}
          </p>
          {uploadError ? (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              {uploadError}
            </p>
          ) : null}
          {uploadSuccess ? (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {uploadSuccess}
            </p>
          ) : null}
        </Card>
      ) : null}

      {showDocumentsSection ? (
        <Card
          title="Documents"
          description={
            useMockData
              ? "Your files are available in this workspace."
              : "Open, review, and manage your uploaded files."
          }
        >
          {groupingMode === "admin-groups" ? (
            <div className="mb-4 flex items-start justify-between gap-3">
              <div
                className="flex flex-wrap items-center gap-3"
                role="group"
                aria-label="Filter by document group"
              >
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Showing{" "}
                  {documentItems.length > 0
                    ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, adminPagination?.total ?? 0)}`
                    : "0"}{" "}
                  of {adminPagination?.total ?? 0}
                </div>

                <button
                  type="button"
                  aria-pressed={selectedGroup === "all"}
                  onClick={() => {
                    setPage(1);
                    setSelectedGroup("all");
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                    selectedGroup === "all"
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:border-cyan-300 dark:bg-cyan-300/15 dark:text-cyan-100"
                      : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-white/20 dark:text-slate-300 dark:hover:border-white/35"
                  }`}
                >
                  All ({adminGroupFilters?.total ?? 0})
                </button>
                {(adminGroupFilters?.availableGroups ?? []).map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    aria-pressed={selectedGroup === group.key}
                    onClick={() => {
                      setPage(1);
                      setSelectedGroup(group.key);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                      selectedGroup === group.key
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:border-cyan-300 dark:bg-cyan-300/15 dark:text-cyan-100"
                        : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-white/20 dark:text-slate-300 dark:hover:border-white/35"
                    }`}
                  >
                    {group.label} ({adminGroupFilters?.byGroup[group.key] ?? 0})
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsDocumentsExpanded((current) => !current)}
                aria-expanded={isDocumentsExpanded}
                className="inline-flex shrink-0 items-center gap-1 px-1 py-1 text-xs text-slate-600 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:text-slate-300 dark:hover:text-slate-100"
              >
                {isDocumentsExpanded ? "Collapse" : "Expand"}
                {isDocumentsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          ) : null}

          {!useMockData && documentsQuery.isLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Loading documents...
            </p>
          ) : null}
          {!useMockData && documentsQuery.isError ? (
            <p className="text-sm text-red-700 dark:text-red-300">
              Unable to list documents. Verify bucket policy and prefix access.
            </p>
          ) : null}

          {isDocumentsExpanded ? (
            <div className="mt-2 space-y-4">
              {groupingMode === "admin-groups" ? (
                <div className="space-y-2">
                  {documentItems.map((doc) => {
                    const getFileIcon = () => {
                      const name = doc.name.toLowerCase();
                      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name))
                        return Image;
                      if (/\.pdf$/i.test(name)) return FileText;
                      return File;
                    };
                    const FileIcon = getFileIcon();
                    return (
                      <article
                        key={doc.path}
                        className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                      >
                        <FileIcon
                          className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium text-slate-900 dark:text-white"
                            title={doc.name}
                          >
                            {doc.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatSize(doc.size)} •{" "}
                            {doc.updatedAt
                              ? new Date(doc.updatedAt).toLocaleDateString()
                              : "Unknown date"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            disabled={openMutation.isPending && !useMockData}
                            onClick={() => {
                              if (useMockData) {
                                setViewingFile({
                                  fileName: doc.name,
                                  url: null,
                                  mimeType: undefined,
                                });
                                setIsViewerOpen(true);
                                return;
                              }
                              setViewingFile({
                                fileName: doc.name,
                                url: null,
                                mimeType: undefined,
                              });
                              setIsViewerOpen(true);
                              openMutation.mutate({ bucket, path: doc.path });
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-amber-600 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-300"
                            aria-label={`View ${doc.name}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={
                              downloadMutation.isPending && !useMockData
                            }
                            onClick={() => {
                              if (useMockData) {
                                window.alert(`Download ready for ${doc.name}`);
                                return;
                              }
                              downloadMutation.mutate({
                                bucket,
                                path: doc.path,
                              });
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-green-600 transition hover:bg-green-50 hover:text-green-700 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-500/20 dark:hover:text-green-300"
                            aria-label={`Download ${doc.name}`}
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={deleteMutation.isPending && !useMockData}
                            onClick={() => {
                              setDeleteConfirmation({
                                open: true,
                                fileName: doc.name,
                                bucket,
                                path: doc.path,
                              });
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                            aria-label={`Delete ${doc.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                groupedDocumentItems.map((group) => (
                  <section
                    key={group.group}
                    aria-label={`${group.group} documents`}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <button
                      type="button"
                      className="mb-3 flex w-full items-center justify-between gap-2 border-b border-slate-200 pb-2 text-left dark:border-white/10"
                      onClick={() =>
                        setOpenDocumentSections((current) => ({
                          ...current,
                          [group.group]: !current[group.group],
                        }))
                      }
                      aria-expanded={openDocumentSections[group.group] ?? true}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                          {group.group}
                        </p>
                        <Badge>{group.docs.length}</Badge>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        {(openDocumentSections[group.group] ?? true)
                          ? "Collapse"
                          : "Expand"}
                        {(openDocumentSections[group.group] ?? true) ? (
                          <ChevronUp
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronDown
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </button>

                    {(openDocumentSections[group.group] ?? true) ? (
                      <div className="space-y-2">
                        {group.docs.map((doc) => {
                          const getFileIcon = () => {
                            const name = doc.name.toLowerCase();
                            if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name))
                              return Image;
                            if (/\.pdf$/i.test(name)) return FileText;
                            return File;
                          };
                          const FileIcon = getFileIcon();
                          return (
                            <article
                              key={doc.path}
                              className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                            >
                              <FileIcon
                                className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400"
                                aria-hidden="true"
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className="truncate text-sm font-medium text-slate-900 dark:text-white"
                                  title={doc.name}
                                >
                                  {doc.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatSize(doc.size)} •{" "}
                                  {doc.updatedAt
                                    ? new Date(
                                        doc.updatedAt,
                                      ).toLocaleDateString()
                                    : "Unknown date"}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                                <button
                                  type="button"
                                  disabled={
                                    openMutation.isPending && !useMockData
                                  }
                                  onClick={() => {
                                    if (useMockData) {
                                      setViewingFile({
                                        fileName: doc.name,
                                        url: null,
                                        mimeType: undefined,
                                      });
                                      setIsViewerOpen(true);
                                      return;
                                    }
                                    setViewingFile({
                                      fileName: doc.name,
                                      url: null,
                                      mimeType: undefined,
                                    });
                                    setIsViewerOpen(true);
                                    openMutation.mutate({
                                      bucket,
                                      path: doc.path,
                                    });
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded text-amber-600 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-300"
                                  aria-label={`View ${doc.name}`}
                                >
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    downloadMutation.isPending && !useMockData
                                  }
                                  onClick={() => {
                                    if (useMockData) {
                                      window.alert(
                                        `Download ready for ${doc.name}`,
                                      );
                                      return;
                                    }
                                    downloadMutation.mutate({
                                      bucket,
                                      path: doc.path,
                                    });
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded text-green-600 transition hover:bg-green-50 hover:text-green-700 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-500/20 dark:hover:text-green-300"
                                  aria-label={`Download ${doc.name}`}
                                >
                                  <Download
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    deleteMutation.isPending && !useMockData
                                  }
                                  onClick={() => {
                                    setDeleteConfirmation({
                                      open: true,
                                      fileName: doc.name,
                                      bucket,
                                      path: doc.path,
                                    });
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                                  aria-label={`Delete ${doc.name}`}
                                >
                                  <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                ))
              )}

              {!documentsQuery.isLoading && documentItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/20 dark:bg-white/[0.03]">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No files found.
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Upload a file and it will appear here.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {groupingMode === "admin-groups" && isDocumentsExpanded ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p
                aria-live="polite"
                aria-atomic="true"
                className="text-xs text-slate-500 dark:text-slate-400"
              >
                Page {adminPagination?.page ?? 1} of{" "}
                {adminPagination?.totalPages ?? 1}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!adminPagination?.hasPrevPage}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!adminPagination?.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {deleteConfirmation?.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Delete file?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete{" "}
              <span className="font-medium">{deleteConfirmation.fileName}</span>
              ? This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (useMockData) {
                    setLocalDocs((current) =>
                      current.filter(
                        (item) => item.path !== deleteConfirmation.path,
                      ),
                    );
                    setDeleteConfirmation(null);
                    return;
                  }
                  deleteMutation.mutate(
                    {
                      bucket: deleteConfirmation.bucket,
                      path: deleteConfirmation.path,
                    },
                    {
                      onSuccess: () => {
                        setDeleteConfirmation(null);
                      },
                    },
                  );
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DocumentViewerModal
        open={isViewerOpen}
        fileName={viewingFile?.fileName ?? ""}
        url={viewingFile?.url ?? null}
        mimeType={viewingFile?.mimeType}
        onClose={() => {
          setIsViewerOpen(false);
          setViewingFile(null);
        }}
      />
    </div>
  );
}

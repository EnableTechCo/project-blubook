"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/ui/file-uploader";
import {
  createSignedDocumentUrl,
  type DocumentRecord,
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
  acceptedFileTypes = "application/pdf,image/*",
  uploadHint = "Accepted formats: PDF and images (JPG, PNG, HEIC, WebP).",
}: {
  title: string;
  description: string;
  bucket: string;
  prefix: string;
  mockDocuments?: LocalDocumentSeed[];
  documentTypeOptions?: DocumentTypeOption[];
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
  const [localDocs, setLocalDocs] = useState<LocalMockDocument[]>(
    mockDocuments ?? [],
  );

  const queryKey = useMemo(
    () => ["documents", bucket, prefix],
    [bucket, prefix],
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

  const documentsQuery = useQuery({
    queryKey,
    queryFn: () => listDocuments({ bucket, prefix }),
    enabled: !useMockData,
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

  const documentItems: Array<
    Pick<DocumentRecord, "name" | "path" | "size" | "updatedAt"> & {
      documentType?: string;
      documentTypeLabel?: string;
    }
  > = useMockData ? localDocs : (documentsQuery.data ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-200/80">{description}</p>
        </div>
        <Badge className="uppercase">{bucket}</Badge>
      </div>

      <Card
        title="Upload"
        description="Upload and store files securely in your workspace."
      >
        {documentTypeOptions?.length ? (
          <div className="relative mb-4 overflow-hidden rounded-xl border border-cyan-300/25 bg-slate-950/40 p-3">
            <div className="pointer-events-none absolute -right-6 -top-6 h-14 w-14 rounded-full bg-cyan-300/20 blur-xl" />
            <div className="pointer-events-none absolute -bottom-8 left-8 h-12 w-12 rounded-full bg-sky-300/20 blur-xl" />

            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100/90">
              Document type
            </label>

            <div className="relative">
              <select
                value={selectedDocumentType}
                onChange={(event) =>
                  setSelectedDocumentType(event.target.value)
                }
                disabled={uploadMutation.isPending}
                className="w-full appearance-none rounded-lg border border-cyan-200/30 bg-slate-950/80 px-3 py-2 pr-10 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
              >
                {!selectedDocumentType ? (
                  <option value="" className="bg-slate-950 text-slate-100">
                    Select document type
                  </option>
                ) : null}
                {groupedDocumentTypeOptions.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-slate-950 text-slate-100"
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-cyan-100/90">
                ▾
              </span>
            </div>
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
          className="border border-white/20 bg-white/5 hover:bg-white/10"
        />
        <p className="mt-2 text-xs text-slate-300">{uploadHint}</p>
        {uploadError ? (
          <p className="mt-2 text-sm text-red-300">{uploadError}</p>
        ) : null}
        {uploadSuccess ? (
          <p className="mt-2 text-sm text-emerald-300">{uploadSuccess}</p>
        ) : null}
      </Card>

      <Card
        title="Documents"
        description={
          useMockData
            ? "Documents are available and managed in this workspace."
            : "Secure access links are generated on demand."
        }
      >
        {!useMockData && documentsQuery.isLoading ? (
          <p className="text-sm text-slate-300">Loading documents...</p>
        ) : null}
        {!useMockData && documentsQuery.isError ? (
          <p className="text-sm text-red-300">
            Unable to list documents. Verify bucket policy and prefix access.
          </p>
        ) : null}

        <div className="mt-2 space-y-3">
          {documentItems.map((doc) => (
            <article
              key={doc.path}
              className="rounded-xl border border-white/15 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{doc.name}</p>
                <div className="flex items-center gap-2">
                  {doc.documentTypeLabel ? (
                    <Badge>{doc.documentTypeLabel}</Badge>
                  ) : null}
                  <Badge>{formatSize(doc.size)}</Badge>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                {doc.updatedAt
                  ? new Date(doc.updatedAt).toLocaleString()
                  : "Unknown update time"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={openMutation.isPending && !useMockData}
                  onClick={() => {
                    if (useMockData) {
                      window.alert(`Preview ready for ${doc.name}`);
                      return;
                    }
                    openMutation.mutate({ bucket, path: doc.path });
                  }}
                >
                  Open
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteMutation.isPending && !useMockData}
                  onClick={() => {
                    if (useMockData) {
                      setLocalDocs((current) =>
                        current.filter((item) => item.path !== doc.path),
                      );
                      return;
                    }
                    deleteMutation.mutate({ bucket, path: doc.path });
                  }}
                >
                  Remove
                </Button>
              </div>
            </article>
          ))}
          {!documentsQuery.isLoading && documentItems.length === 0 ? (
            <p className="text-sm text-slate-300">
              No files found for this scope.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createSignedDocumentUrl,
  listDocuments,
  removeDocument,
  uploadDocument,
} from "@/services/documents.service";
import type { MockDocument } from "@/features/mock/dashboard-data";

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
}: {
  title: string;
  description: string;
  bucket: string;
  prefix: string;
  mockDocuments?: MockDocument[];
}) {
  const useMockData = Boolean(mockDocuments?.length);
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState<MockDocument[]>(
    mockDocuments ?? [],
  );

  const queryKey = useMemo(
    () => ["documents", bucket, prefix],
    [bucket, prefix],
  );

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

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError(null);

    const cleanedName = file.name.replace(/\s+/g, "-").toLowerCase();
    const path = `${prefix}/${Date.now()}-${cleanedName}`;

    if (useMockData) {
      setLocalDocs((current) => [
        {
          path,
          name: file.name,
          size: file.size,
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ]);
      event.target.value = "";
      return;
    }

    try {
      await uploadMutation.mutateAsync({ bucket, path, file });
      event.target.value = "";
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const documentItems = useMockData ? localDocs : (documentsQuery.data ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Phase 2
          </p>
          <h2 className="text-3xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-200/80">{description}</p>
        </div>
        <Badge className="uppercase">{bucket}</Badge>
      </div>

      <Card
        title="Upload"
        description="Store files securely in Supabase Storage buckets."
      >
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">
          <span>
            {uploadMutation.isPending ? "Uploading..." : "Choose file"}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={onFileChange}
            disabled={uploadMutation.isPending}
          />
        </label>
        {uploadError ? (
          <p className="mt-2 text-sm text-red-300">{uploadError}</p>
        ) : null}
      </Card>

      <Card
        title="Documents"
        description={
          useMockData
            ? "Hardcoded and locally managed documents for UI demos."
            : "Short-lived signed URLs are generated on demand."
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
                <Badge>{formatSize(doc.size)}</Badge>
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

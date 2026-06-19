"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type DocumentRow = {
  id: string;
  fileName: string;
  bucket: string;
  mimeType: string | null;
  sizeBytes: number | null;
  documentType: string | null;
  organizationId: string | null;
  organizationName: string | null;
  uploaderEmail: string | null;
  uploaderName: string | null;
  createdAt: string;
  updatedAt: string;
};

type DocumentsPayload = {
  metrics: {
    total: number;
    totalSizeBytes: number;
    byMimeType: Record<string, number>;
  };
  documents: DocumentRow[];
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function AdminDocumentsPage() {
  const docsQuery = useQuery({
    queryKey: ["admin-documents"],
    queryFn: async (): Promise<DocumentsPayload> => {
      const response = await fetch("/api/admin/documents", {
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load documents.");
      }

      return {
        metrics: body?.metrics ?? {
          total: 0,
          totalSizeBytes: 0,
          byMimeType: {},
        },
        documents: (body?.documents ?? []) as DocumentRow[],
      };
    },
    refetchInterval: 60000,
  });

  const mimeRows = useMemo(() => {
    const byMimeType = docsQuery.data?.metrics.byMimeType ?? {};
    return Object.entries(byMimeType).sort((a, b) => b[1] - a[1]);
  }, [docsQuery.data?.metrics.byMimeType]);

  if (docsQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading documents...</p>;
  }

  if (docsQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {docsQuery.error instanceof Error
          ? docsQuery.error.message
          : "Could not load documents."}
      </p>
    );
  }

  const metrics = docsQuery.data?.metrics ?? {
    total: 0,
    totalSizeBytes: 0,
    byMimeType: {},
  };
  const documents = docsQuery.data?.documents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Documents</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            System-wide document uploads with organization and uploader context.
          </p>
        </div>
        <Badge>{metrics.total} Documents</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Total Documents">
          <p className="text-3xl font-semibold text-white">{metrics.total}</p>
        </Card>
        <Card title="Total Storage">
          <p className="text-3xl font-semibold text-white">
            {formatBytes(metrics.totalSizeBytes)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <Card
          title="File Types"
          description="What kinds of files have been uploaded."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">MIME Type</th>
                  <th className="px-3 py-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {mimeRows.map(([mime, count]) => (
                  <tr key={mime} className="border-b border-white/10">
                    <td className="px-3 py-2">{mime}</td>
                    <td className="px-3 py-2">{count}</td>
                  </tr>
                ))}
                {mimeRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={2}>
                      No file types.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Recent Documents"
          description="Recently uploaded files — who uploaded them, on whose behalf, and when."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/15 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Organization</th>
                  <th className="px-3 py-2">Uploader</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-white/10">
                    <td className="max-w-[180px] truncate px-3 py-2">
                      {doc.fileName}
                    </td>
                    <td className="px-3 py-2">
                      {doc.documentType ?? doc.mimeType ?? "Unknown"}
                    </td>
                    <td className="px-3 py-2">
                      {doc.organizationName ?? "Unknown org"}
                    </td>
                    <td className="px-3 py-2">
                      {doc.uploaderName ?? doc.uploaderEmail ?? "Unknown"}
                    </td>
                    <td className="px-3 py-2">
                      {doc.sizeBytes !== null
                        ? formatBytes(doc.sizeBytes)
                        : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(doc.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {documents.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={6}>
                      No documents found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

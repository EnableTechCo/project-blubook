"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  FileType2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentViewerModal } from "@/components/ui/document-viewer-modal";

function isImageMime(mimeType: string | null, fileName: string) {
  const mime = (mimeType ?? "").toLowerCase();
  const name = fileName.toLowerCase();
  return (
    mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(name)
  );
}

function isPdfMime(mimeType: string | null, fileName: string) {
  return (
    (mimeType ?? "").toLowerCase() === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  );
}

function DocThumbnail({
  id,
  fileName,
  mimeType,
}: {
  id: string;
  fileName: string;
  mimeType: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !isImageMime(mimeType, fileName)) return;
    fetch(`/api/admin/documents/${id}/view`, { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (body?.signedUrl) setSignedUrl(body.signedUrl);
      })
      .catch(() => null);
  }, [visible, id, mimeType, fileName]);

  const isImage = isImageMime(mimeType, fileName);
  const isPdf = isPdfMime(mimeType, fileName);

  return (
    <div
      ref={ref}
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50"
    >
      {isImage && signedUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signedUrl}
          alt={fileName}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : isPdf ? (
        <FileType2 className="h-5 w-5 text-red-400" aria-hidden="true" />
      ) : isImage ? (
        <ImageIcon className="h-5 w-5 text-sky-400" aria-hidden="true" />
      ) : (
        <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
      )}
    </div>
  );
}

type DocumentRow = {
  id: string;
  fileName: string;
  bucket: string;
  mimeType: string | null;
  sizeBytes: number | null;
  documentType: string | null;
  documentTypeLabel: string | null;
  groupKey:
    | "requirements-docs"
    | "service-request-docs"
    | "delivery-docs"
    | "purchase-orders"
    | "commercial-docs"
    | "compliance-docs";
  groupLabel: string;
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
    pageCount: number;
    totalSizeBytes: number;
    byMimeType: Record<string, number>;
    byGroup: {
      "requirements-docs": number;
      "service-request-docs": number;
      "delivery-docs": number;
      "purchase-orders": number;
      "commercial-docs": number;
      "compliance-docs": number;
    };
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
  filters: {
    search: string;
    bucket: string;
    selectedGroup?:
      | "requirements-docs"
      | "service-request-docs"
      | "delivery-docs"
      | "purchase-orders"
      | "commercial-docs"
      | "compliance-docs"
      | null;
    availableBuckets: string[];
    availableGroups: Array<{
      key:
        | "requirements-docs"
        | "service-request-docs"
        | "delivery-docs"
        | "purchase-orders"
        | "commercial-docs"
        | "compliance-docs";
      label: string;
    }>;
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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState("");
  const [viewer, setViewer] = useState<{
    open: boolean;
    fileName: string;
    url: string | null;
    mimeType: string | null;
  }>({ open: false, fileName: "", url: null, mimeType: null });
  const [selectedGroup, setSelectedGroup] = useState<
    | "all"
    | "requirements-docs"
    | "service-request-docs"
    | "delivery-docs"
    | "purchase-orders"
    | "commercial-docs"
    | "compliance-docs"
  >("all");

  const docsQuery = useQuery({
    queryKey: [
      "admin-documents",
      page,
      pageSize,
      search,
      bucket,
      selectedGroup,
    ],
    queryFn: async (): Promise<DocumentsPayload> => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim().length > 0) {
        params.set("search", search.trim());
      }
      if (bucket.trim().length > 0) {
        params.set("bucket", bucket.trim());
      }
      if (selectedGroup !== "all") {
        params.set("group", selectedGroup);
      }

      const response = await fetch(
        `/api/admin/documents?${params.toString()}`,
        {
          credentials: "include",
        },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load documents.");
      }

      return {
        metrics: body?.metrics ?? {
          total: 0,
          pageCount: 0,
          totalSizeBytes: 0,
          byMimeType: {},
          byGroup: {
            "requirements-docs": 0,
            "service-request-docs": 0,
            "delivery-docs": 0,
            "purchase-orders": 0,
            "commercial-docs": 0,
            "compliance-docs": 0,
          },
        },
        pagination: body?.pagination ?? {
          page: 1,
          pageSize,
          total: 0,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        },
        filters: body?.filters ?? {
          search: "",
          bucket: "",
          availableBuckets: [],
          availableGroups: [],
        },
        documents: (body?.documents ?? []) as DocumentRow[],
      };
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: 60000,
  });

  if (docsQuery.isLoading) {
    return (
      <div
        className="animate-pulse space-y-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-9 w-48 rounded-lg bg-slate-200" />
            <div className="h-4 w-64 rounded-lg bg-slate-200" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-52 rounded-lg bg-slate-200" />
            <div className="h-9 w-16 rounded-lg bg-slate-200" />
            <div className="h-9 w-16 rounded-lg bg-slate-200" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface rounded-2xl p-5 shadow-panel">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="surface rounded-2xl p-5 shadow-panel">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-28 rounded-full bg-slate-200" />
            ))}
          </div>
        </div>

        <div className="surface rounded-2xl p-5 shadow-panel">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded bg-slate-200" />
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="ml-auto h-4 w-24 rounded bg-slate-200" />
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (docsQuery.isError) {
    return (
      <p role="alert" className="text-sm text-red-300">
        {docsQuery.error instanceof Error
          ? docsQuery.error.message
          : "Could not load documents."}
      </p>
    );
  }

  const metrics = docsQuery.data?.metrics ?? {
    total: 0,
    pageCount: 0,
    totalSizeBytes: 0,
    byMimeType: {},
    byGroup: {
      "requirements-docs": 0,
      "service-request-docs": 0,
      "delivery-docs": 0,
      "purchase-orders": 0,
      "commercial-docs": 0,
      "compliance-docs": 0,
    },
  };
  const pagination = docsQuery.data?.pagination ?? {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  };
  const filters = docsQuery.data?.filters ?? {
    search: "",
    bucket: "",
    selectedGroup: null,
    availableBuckets: [],
    availableGroups: [],
  };
  const documents = docsQuery.data?.documents ?? [];
  const rangeStart =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd =
    pagination.total === 0 ? 0 : rangeStart + Math.max(documents.length - 1, 0);
  const pageLabel = `Page ${pagination.page} of ${pagination.totalPages}`;
  const latestUploadOnPage =
    documents.length > 0
      ? new Date(
          documents.reduce(
            (latest, doc) =>
              new Date(doc.createdAt).getTime() > new Date(latest).getTime()
                ? doc.createdAt
                : latest,
            documents[0].createdAt,
          ),
        )
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Documents</h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Find and review uploaded files.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="doc-search" className="sr-only">
            Search documents by file name
          </label>
          <input
            id="doc-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPage(1);
                setSearch(searchInput);
              }
            }}
            placeholder="Search by file name"
            className="h-9 w-52 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          />
          <Button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch(searchInput);
            }}
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPage(1);
              setSearchInput("");
              setSearch("");
              setBucket("");
              setSelectedGroup("all");
            }}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Documents">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {pagination.total}
          </p>
        </Card>
        <Card title="Showing">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {rangeStart}-{rangeEnd}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Current visible range
          </p>
        </Card>
        <Card title="Page Storage">
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {formatBytes(metrics.totalSizeBytes)}
          </p>
        </Card>
        <Card title="Latest Upload On Page">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {latestUploadOnPage
              ? latestUploadOnPage.toLocaleString()
              : "No uploads"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </Card>
      </div>

      <Card
        title="Document Groups"
        description="Requirements Docs, Service Request Docs, Delivery Docs, Commercial Docs, and Compliance Docs."
      >
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by document group"
        >
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
            All ({metrics.total})
          </button>
          {filters.availableGroups.map((group) => (
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
              {group.label} ({metrics.byGroup[group.key] ?? 0})
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4">
        <Card
          title="Documents"
          description="Latest files for your current filters."
        >
          <p className="mb-3 text-xs font-medium text-slate-600 dark:text-slate-300">
            Showing {rangeStart}-{rangeEnd} of {pagination.total} documents
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
            <table
              className="min-w-full text-left text-sm"
              aria-label="Documents"
            >
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-widest text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    File
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Group
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Organization
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Uploader
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Size
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Uploaded
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {documents.map((doc, idx) => (
                  <tr
                    key={doc.id}
                    className={`group transition-colors duration-100 hover:bg-cyan-50 dark:hover:bg-cyan-400/[0.05] ${idx % 2 !== 0 ? "bg-slate-50/60 dark:bg-white/[0.02]" : ""}`}
                  >
                    <td className="tabular-nums px-4 py-3 text-slate-500 dark:text-slate-400">
                      {rangeStart + idx}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <DocThumbnail
                          id={doc.id}
                          fileName={doc.fileName}
                          mimeType={doc.mimeType}
                        />
                        <span
                          className="max-w-[200px] truncate font-medium text-slate-800 transition-colors group-hover:text-slate-900 dark:text-slate-100 dark:group-hover:text-white"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
                        {doc.groupLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {doc.organizationName ?? (
                        <span className="text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {doc.uploaderName ?? doc.uploaderEmail ?? (
                        <span className="text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums px-4 py-3 text-slate-500 dark:text-slate-400">
                      {doc.sizeBytes !== null ? (
                        formatBytes(doc.sizeBytes)
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums px-4 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(doc.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label={`View ${doc.fileName}`}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-cyan-500/50 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-95 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200 dark:focus-visible:ring-offset-slate-900"
                        onClick={async () => {
                          setViewer({
                            open: true,
                            fileName: doc.fileName,
                            url: null,
                            mimeType: doc.mimeType,
                          });
                          const res = await fetch(
                            `/api/admin/documents/${doc.id}/view`,
                            {
                              credentials: "include",
                            },
                          );
                          const body = await res.json().catch(() => null);
                          setViewer((prev) => ({
                            ...prev,
                            url: body?.signedUrl ?? null,
                          }));
                        }}
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                      colSpan={8}
                    >
                      No documents found for these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p
              aria-live="polite"
              aria-atomic="true"
              className="text-xs text-slate-500 dark:text-slate-400"
            >
              {pageLabel}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <DocumentViewerModal
        open={viewer.open}
        fileName={viewer.fileName}
        url={viewer.url}
        mimeType={viewer.mimeType}
        onClose={() =>
          setViewer({ open: false, fileName: "", url: null, mimeType: null })
        }
      />
    </div>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import { X, ExternalLink, Download, FileText, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

type DocumentViewerModalProps = {
  open: boolean;
  fileName: string;
  url: string | null;
  mimeType?: string | null;
  onClose: () => void;
};

function resolveStrategy(fileName: string, mimeType?: string | null) {
  const mime = (mimeType ?? "").toLowerCase();
  const name = fileName.toLowerCase();

  if (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(name)
  ) {
    return "image" as const;
  }

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf" as const;
  }

  return "download" as const;
}

export function DocumentViewerModal({
  open,
  fileName,
  url,
  mimeType,
  onClose,
}: DocumentViewerModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [pdfBlocked, setPdfBlocked] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setImgError(false);
    setPdfBlocked(false);
  }, [url]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const strategy = imgError ? "download" : resolveStrategy(fileName, mimeType);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-dvh min-h-dvh w-screen flex-col overflow-hidden bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText
            className="h-4 w-4 shrink-0 text-white"
            aria-hidden="true"
          />
          <span
            id={titleId}
            className="truncate text-sm font-medium text-white"
            title={fileName}
          >
            {fileName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {url && (
            <>
              <a
                href={url}
                download={fileName}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-white/60 bg-white/10 px-3 text-xs font-medium text-white transition hover:border-white hover:bg-white/20"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download</span>
              </a>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded border border-white/60 bg-white/10 px-3 text-xs font-medium text-white transition hover:border-white hover:bg-white/20"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-white">Open in new tab</span>
              </a>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/60 bg-white/10 text-white transition hover:border-white hover:bg-white/20"
            aria-label="Close document viewer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-900">
        {!url ? (
          <div
            className="flex flex-col items-center gap-3 text-white"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
            <p style={{ color: "white" }}>Loading document…</p>
          </div>
        ) : strategy === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={fileName}
            className="max-h-full max-w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : strategy === "pdf" && !pdfBlocked ? (
          <object
            data={url}
            type="application/pdf"
            className="h-full w-full"
            aria-label={`PDF preview of ${fileName}`}
            onError={() => setPdfBlocked(true)}
          >
            {/* Fallback: browser doesn't support inline PDF */}
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <FileText
                className="h-12 w-12 text-slate-300"
                aria-hidden="true"
              />
              <p className="text-sm text-white">
                Your browser can&apos;t preview this PDF inline.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/60 bg-white/10 px-4 text-sm font-medium text-white transition hover:border-white hover:bg-white/20"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open {fileName}
              </a>
            </div>
          </object>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-white/15 bg-white/5 p-10 text-center">
            <FileText className="h-12 w-12 text-slate-300" aria-hidden="true" />
            <p className="text-sm text-white">
              {strategy === "pdf"
                ? "This PDF can't be previewed inline (blocked by browser security policy)."
                : "This file type can't be previewed in the browser."}
            </p>
            <div className="flex gap-3">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/60 bg-white/10 px-4 text-sm font-medium text-white transition hover:border-white hover:bg-white/20"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open in new tab
              </a>
              <a
                href={url}
                download={fileName}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/60 bg-white/10 px-4 text-sm font-medium text-white transition hover:border-white hover:bg-white/20"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

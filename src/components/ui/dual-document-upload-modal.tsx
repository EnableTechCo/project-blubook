import { Button } from "@/components/ui/button";
import { DocumentUploadField } from "@/components/ui/document-upload-field";
import { InlineErrorMessage } from "@/components/ui/inline-error-message";

export function DualDocumentUploadModal({
  open,
  title,
  description,
  firstLabel,
  firstFileName,
  onSelectFirst,
  secondLabel,
  secondFileName,
  onSelectSecond,
  error,
  busy,
  onClose,
  onConfirm,
  confirmLabel,
  busyLabel,
}: {
  open: boolean;
  title: string;
  description: string;
  firstLabel: string;
  firstFileName: string | null;
  onSelectFirst: (file: File | null) => void;
  secondLabel: string;
  secondFileName: string | null;
  onSelectSecond: (file: File | null) => void;
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busyLabel?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_18px_44px_-24px_rgba(15,23,42,0.45)]"
        style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>

        <div className="mt-4 grid gap-4">
          <DocumentUploadField
            title={firstLabel}
            helper="Upload PDF or image."
            fileName={firstFileName}
            disabled={busy}
            onSelect={onSelectFirst}
          />
          <DocumentUploadField
            title={secondLabel}
            helper="Upload PDF or image."
            fileName={secondFileName}
            disabled={busy}
            onSelect={onSelectSecond}
          />
        </div>

        <InlineErrorMessage className="mt-3" message={error} />

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-3 text-xs"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-8 rounded-md bg-cyan-400/90 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (busyLabel ?? "Working...") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

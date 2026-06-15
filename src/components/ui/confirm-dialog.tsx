"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  ariaLabel: string;
  title: string;
  description: string;
  warning?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  ariaLabel,
  title,
  description,
  warning,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div
        className="surface w-full max-w-lg rounded-2xl border border-white/20 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="mt-1 text-2xl font-semibold text-white">{title}</h3>
        <p className="mt-3 text-sm text-slate-200">{description}</p>
        {warning ? (
          <p className="mt-1 text-xs text-slate-200">{warning}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

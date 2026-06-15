import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function RetractOrderDialog({
  open,
  title,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      ariaLabel="Retract purchase order"
      title={title}
      description="This removes the order and related workflow records."
      warning="Intended for testing and workflow reset scenarios."
      confirmLabel="Confirm Retract"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

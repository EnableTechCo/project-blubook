import type { ReactNode } from "react";

export function PurchaseOrderReviewPanel({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 rounded-md border border-white/10 bg-slate-900/50 p-3">
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

export function CustomerWorkflowPanelContainer({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
      {children}
    </div>
  );
}

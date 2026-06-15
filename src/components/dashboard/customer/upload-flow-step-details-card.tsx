import type { ReactNode } from "react";

export function UploadFlowStepDetailsCard({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      {children}
    </div>
  );
}

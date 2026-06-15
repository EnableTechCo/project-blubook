import type { ReactNode } from "react";

export function UploadFlowStepCards({ children }: { children?: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-5">{children}</div>;
}

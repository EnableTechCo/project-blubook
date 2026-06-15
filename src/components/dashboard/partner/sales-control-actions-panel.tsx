import type { ReactNode } from "react";

export function SalesControlActionsPanel({
  children,
}: {
  children?: ReactNode;
}) {
  return <div className="mb-3">{children}</div>;
}

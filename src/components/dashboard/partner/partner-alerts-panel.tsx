import type { ReactNode } from "react";

export function PartnerAlertsPanel({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="space-y-1">{children}</div>;
}

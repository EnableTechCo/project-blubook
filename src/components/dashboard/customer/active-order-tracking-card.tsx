import type { ReactNode } from "react";

export function ActiveOrderTrackingCard({
  children,
}: {
  children?: ReactNode;
}) {
  return <div className="space-y-4">{children}</div>;
}

import type { ReactNode } from "react";

export function LogisticsWorkOrderCard({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      {children}
    </div>
  );
}

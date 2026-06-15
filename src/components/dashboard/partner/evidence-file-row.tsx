import type { ReactNode } from "react";

export function EvidenceFileRow({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-2 py-1">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

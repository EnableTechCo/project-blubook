import type { ReactNode } from "react";

export function CurrentOwnerPill({
  owner,
  next,
  extra,
}: {
  owner: string;
  next: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
      <span className="text-xs font-medium text-slate-900">{owner}</span>
      <span className="text-[11px] text-cyan-700">- {next}</span>
      {extra ? extra : null}
    </div>
  );
}

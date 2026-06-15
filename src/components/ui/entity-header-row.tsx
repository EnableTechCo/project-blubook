import type { ReactNode } from "react";

export function EntityHeaderRow({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs font-semibold text-slate-900">{title}</p>
        {subtitle ? (
          <p className="text-[11px] text-slate-600">{subtitle}</p>
        ) : null}
      </div>
      {right ? right : null}
    </div>
  );
}

import type { ReactNode } from "react";

export function EmptyStateNoticeCard({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      {icon ? icon : null}
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-600">{description}</p>
      </div>
      {action ? action : null}
    </div>
  );
}

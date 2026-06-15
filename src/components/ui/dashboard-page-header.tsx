import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardPageHeader({
  title,
  subtitle,
  badge,
  className,
  subtitleClassName,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  className?: string;
  subtitleClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">{title}</h2>
        {subtitle ? (
          <p className={cn("mt-1 text-sm text-slate-600", subtitleClassName)}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {badge ? badge : null}
    </div>
  );
}

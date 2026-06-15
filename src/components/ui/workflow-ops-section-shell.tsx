import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "amber" | "cyan" | "slate";

const toneClassByTone: Record<Tone, string> = {
  amber: "border-amber-300/35 bg-amber-50",
  cyan: "border-cyan-300/30 bg-cyan-50",
  slate: "border-slate-200 bg-slate-50",
};

export function WorkflowOpsSectionShell({
  title,
  description,
  tone = "slate",
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  tone?: Tone;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn("rounded-2xl px-4 py-4", toneClassByTone[tone], className)}
    >
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-slate-600">{description}</p>
      ) : null}
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}

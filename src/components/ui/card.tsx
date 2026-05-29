import { cn } from "@/lib/utils";

export function Card({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("surface rounded-2xl p-5 shadow-panel", className)}>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-slate-200/80">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

import type { ReactNode } from "react";

export function PartnerRequestQueueItem({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-[0_1px_1px_rgba(15,23,42,0.05),0_8px_20px_rgba(15,23,42,0.08),0_18px_36px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_2px_2px_rgba(15,23,42,0.06),0_14px_30px_rgba(15,23,42,0.12),0_28px_56px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.92)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-100 to-transparent" />
      <div className="pointer-events-none absolute -right-8 bottom-0 h-16 w-16 rounded-full bg-cyan-100/55 blur-xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

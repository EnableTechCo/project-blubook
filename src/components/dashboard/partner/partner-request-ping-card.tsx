import type { ReactNode } from "react";

export function PartnerRequestPingCard({ children }: { children?: ReactNode }) {
  return (
    <div className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_1px_rgba(15,23,42,0.05),0_10px_24px_rgba(15,23,42,0.1),0_24px_48px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_2px_2px_rgba(15,23,42,0.06),0_16px_36px_rgba(15,23,42,0.14),0_32px_64px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-100 to-transparent" />
      <div className="pointer-events-none absolute -bottom-8 left-6 h-20 w-24 rounded-full bg-cyan-100/50 blur-2xl" />
      <div className="relative flex h-full flex-col">{children}</div>
    </div>
  );
}

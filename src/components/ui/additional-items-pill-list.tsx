import type { ReactNode } from "react";

type Item = {
  key: string;
  label: ReactNode;
};

export function AdditionalItemsPillList({
  title,
  items,
}: {
  title: string;
  items: Item[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.key}
            className="rounded-full border border-white/10 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

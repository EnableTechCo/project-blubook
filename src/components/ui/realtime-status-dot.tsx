export function RealtimeStatusDot({
  isLive,
  isStale,
  label,
}: {
  isLive: boolean;
  isStale: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span
        className={`h-2 w-2 rounded-full transition-colors ${
          isLive
            ? "bg-emerald-400 shadow-[0_0_5px_#34d399]"
            : isStale
              ? "bg-amber-400"
              : "bg-slate-600"
        }`}
      />
      <span className="text-[11px] text-slate-400">
        {isLive ? "Live" : isStale ? "Stale" : "Waiting"}
      </span>
    </div>
  );
}

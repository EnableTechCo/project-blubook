type DashboardLoadingSkeletonProps = {
  metricCount?: number;
  listCount?: number;
};

export function DashboardLoadingSkeleton({
  metricCount = 4,
  listCount = 3,
}: DashboardLoadingSkeletonProps) {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-9 w-56 rounded-lg bg-slate-200" />
          <div className="h-4 w-80 max-w-[85vw] rounded-lg bg-slate-200" />
        </div>
        <div className="h-7 w-36 rounded-full bg-slate-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: metricCount }).map((_, index) => (
          <div
            key={`metric-skeleton-${index}`}
            className="surface rounded-2xl p-5 shadow-panel"
          >
            <div className="h-5 w-24 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-40 rounded bg-slate-200" />
            <div className="mt-6 h-8 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div
            key={`section-skeleton-${sectionIndex}`}
            className="surface rounded-2xl p-5 shadow-panel"
          >
            <div className="h-6 w-44 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-64 rounded bg-slate-200" />

            <div className="mt-5 space-y-3">
              {Array.from({ length: listCount }).map((__, rowIndex) => (
                <div
                  key={`row-skeleton-${sectionIndex}-${rowIndex}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-11/12 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-3/5 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

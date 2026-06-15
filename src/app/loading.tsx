import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";

export default function GlobalLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
      <DashboardLoadingSkeleton metricCount={4} listCount={3} />
    </main>
  );
}

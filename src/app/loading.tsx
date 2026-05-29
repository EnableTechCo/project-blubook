export default function GlobalLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-white/10" />
        <div className="h-4 w-80 rounded bg-white/10" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-28 rounded-2xl bg-white/10" />
          <div className="h-28 rounded-2xl bg-white/10" />
          <div className="h-28 rounded-2xl bg-white/10" />
        </div>
      </div>
    </main>
  );
}

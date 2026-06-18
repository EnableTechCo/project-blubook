export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2">
      <div className="hidden lg:block">
        <h1 className="mt-3 text-5xl font-semibold text-slate-300">
          Secure platform access for every operational role.
        </h1>
        <p className="mt-4 max-w-lg text-slate-200/85">
          Sign in to pick up where you left off, check your queue, and keep work
          moving without extra steps.
        </p>
      </div>
      <div className="surface rounded-3xl p-6 shadow-panel lg:p-10">
        {children}
      </div>
    </div>
  );
}

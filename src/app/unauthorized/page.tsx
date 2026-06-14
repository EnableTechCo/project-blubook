import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-amber-200/85">
        403
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-white">Access denied</h1>
      <p className="mt-3 text-sm text-slate-200/85">
        You do not have permission to view this page with your current account.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/">
          <Button>Back to Home</Button>
        </Link>
        <Link href="/login">
          <Button variant="ghost">Switch Account</Button>
        </Link>
      </div>
    </main>
  );
}

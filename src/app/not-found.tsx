import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">404</p>
      <h1 className="mt-3 text-4xl font-semibold text-white">Page not found</h1>
      <p className="mt-3 text-sm text-slate-200/85">
        The page you requested does not exist or was moved.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button>Back to Home</Button>
        </Link>
      </div>
    </main>
  );
}

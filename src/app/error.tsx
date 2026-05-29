"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-cyan-200/80">
        Phase 5
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-white">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-slate-200/85">
        An unexpected issue occurred while rendering this page.
      </p>
      <p className="mt-2 text-xs text-slate-300/80">
        {error.digest ? `Error digest: ${error.digest}` : error.message}
      </p>
      <div className="mt-6">
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}

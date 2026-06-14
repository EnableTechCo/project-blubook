"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

const PROTECTED_PATH_PREFIXES = [
  "/customer",
  "/partner",
  "/staff",
  "/admin",
  "/sales",
  "/logistics",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const SESSION_RELEVANT_API_PREFIXES = ["/api/auth/"];
const SESSION_RELEVANT_API_PATHS = new Set([
  "/api/auth/context",
  "/api/auth/me",
]);

function getRequestPath(input: RequestInfo | URL): string | null {
  try {
    if (typeof input === "string") {
      return new URL(input, window.location.origin).pathname;
    }

    if (input instanceof URL) {
      return new URL(input.toString(), window.location.origin).pathname;
    }

    if (input instanceof Request) {
      return new URL(input.url, window.location.origin).pathname;
    }
  } catch {
    return null;
  }

  return null;
}

function isSessionRelevantPath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  if (SESSION_RELEVANT_API_PATHS.has(pathname)) {
    return true;
  }

  return SESSION_RELEVANT_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

async function isSessionExpiry401(response: Response): Promise<boolean> {
  const sessionExpiredHeader = response.headers.get("x-session-expired");
  if (sessionExpiredHeader === "1" || sessionExpiredHeader === "true") {
    return true;
  }

  try {
    const cloned = response.clone();
    const text = (await cloned.text()).toLowerCase();
    if (!text) {
      return false;
    }

    return (
      text.includes("unauthorized") ||
      text.includes("session") ||
      text.includes("token") ||
      text.includes("jwt")
    );
  } catch {
    return false;
  }
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    let isHandlingExpiry = false;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      const pathname = window.location.pathname;
      if (response.status !== 401 || !isProtectedPath(pathname)) {
        return response;
      }

      const requestPath = getRequestPath(args[0]);
      const hasSessionRelevantPath = isSessionRelevantPath(requestPath);
      const hasSessionExpirySignal = await isSessionExpiry401(response);

      if (!hasSessionRelevantPath && !hasSessionExpirySignal) {
        return response;
      }

      if (!isHandlingExpiry) {
        isHandlingExpiry = true;

        const supabase = createClient();
        await supabase.auth.signOut();

        const next = encodeURIComponent(
          `${window.location.pathname}${window.location.search}`,
        );
        window.location.replace(`/login?next=${next}&reason=session_expired`);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

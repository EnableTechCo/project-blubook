import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/onboarding",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/verify-email",
  "/unauthorized",
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const debug = process.env.NODE_ENV !== "production";
  const devAuthBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== "false";
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let response = NextResponse.next({ request });
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  };

  if (debug) {
    console.log(`[auth-middleware] start ${request.nextUrl.pathname}`);
  }

  // Temporary development bypass: set NEXT_PUBLIC_DEV_AUTH_BYPASS=false to re-enable strict auth locally.
  if (devAuthBypass) {
    if (debug) {
      console.log(
        `[auth-middleware] dev bypass active, allow ${request.nextUrl.pathname}`,
      );
    }
    return response;
  }

  // Fail safe in production deploys with incomplete env setup: do not crash middleware.
  if (!hasSupabaseEnv) {
    console.error(
      "[auth-middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );

    if (isPublicRoute(request.nextUrl.pathname)) {
      return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (debug) {
    console.log(
      `[auth-middleware] public=${isPublicRoute(request.nextUrl.pathname)} user=${user ? "present" : "none"}`,
    );
  }

  if (!user && !isPublicRoute(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);

    if (debug) {
      console.log(`[auth-middleware] redirect -> ${url.pathname}${url.search}`);
    }

    return NextResponse.redirect(url);
  }

  if (debug) {
    console.log(`[auth-middleware] allow ${request.nextUrl.pathname}`);
  }

  return response;
}

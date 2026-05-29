import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/verify-email",
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

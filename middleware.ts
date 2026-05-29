import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never gate static/framework assets behind auth redirects.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.match(
      /\.(?:css|js|map|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/,
    )
  ) {
    return NextResponse.next();
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[middleware] ${request.method} ${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/:path*"],
};

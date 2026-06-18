import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { nextMock, redirectMock, createServerClientMock } = vi.hoisted(() => ({
  nextMock: vi.fn((args?: { request?: unknown }) => ({
    kind: "next",
    request: args?.request,
    cookies: {
      set: vi.fn(),
    },
  })),
  redirectMock: vi.fn((url: unknown) => ({
    kind: "redirect",
    url,
    cookies: {
      set: vi.fn(),
    },
  })),
  createServerClientMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
    redirect: redirectMock,
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { updateSession } from "./middleware";

type MutableUrl = {
  pathname: string;
  searchParams: URLSearchParams;
};

function createRequest(pathname: string) {
  const current = {
    pathname,
    searchParams: new URLSearchParams(),
  };

  return {
    method: "GET",
    nextUrl: {
      pathname: current.pathname,
      search: "",
      searchParams: current.searchParams,
      clone() {
        const url: MutableUrl = {
          pathname: current.pathname,
          searchParams: new URLSearchParams(current.searchParams.toString()),
        };
        return url;
      },
    },
    cookies: {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    },
  } as any;
}

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_DEV_AUTH_BYPASS: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = "false";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = originalEnv.NEXT_PUBLIC_DEV_AUTH_BYPASS;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("allows all routes during dev auth bypass", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS;

    const request = createRequest("/customer/dashboard");
    const result = await updateSession(request);

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalled();
    expect(result.kind).toBe("next");
  });

  it("redirects protected routes to login when supabase env is missing", async () => {
    const request = createRequest("/customer/dashboard");

    const result = await updateSession(request);

    expect(redirectMock).toHaveBeenCalledOnce();
    const [url] = redirectMock.mock.calls[0] as [MutableUrl];
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/customer/dashboard");
    expect(result.kind).toBe("redirect");
  });

  it("allows public routes when supabase env is missing", async () => {
    const request = createRequest("/login");

    const result = await updateSession(request);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalled();
    expect(result.kind).toBe("next");
  });

  it("redirects unauthenticated users from protected routes", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const request = createRequest("/customer/dashboard");

    const result = await updateSession(request);

    expect(createServerClientMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledOnce();
    const [url] = redirectMock.mock.calls[0] as [MutableUrl];
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/customer/dashboard");
    expect(result.kind).toBe("redirect");
  });

  it("allows authenticated users on protected routes", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "user-1" },
          },
        }),
      },
    });

    const request = createRequest("/customer/dashboard");

    const result = await updateSession(request);

    expect(createServerClientMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result.kind).toBe("next");
  });
});

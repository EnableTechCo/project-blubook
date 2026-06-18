import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

type UpdateSessionRequest = Parameters<typeof updateSession>[0];

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
  } as unknown as UpdateSessionRequest;
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows all routes during dev auth bypass", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", undefined);

    const request = createRequest("/customer/dashboard");
    const result = await updateSession(request);

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalledOnce();
    expect(result).toBe(nextMock.mock.results[0]?.value);
  });

  it("redirects protected routes to login when supabase env is missing", async () => {
    const request = createRequest("/customer/dashboard");

    const result = await updateSession(request);

    expect(redirectMock).toHaveBeenCalledOnce();
    const [url] = redirectMock.mock.calls[0] as [MutableUrl];
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/customer/dashboard");
    expect(result).toBe(redirectMock.mock.results[0]?.value);
  });

  it("allows public routes when supabase env is missing", async () => {
    const request = createRequest("/login");

    const result = await updateSession(request);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalledOnce();
    expect(result).toBe(nextMock.mock.results[0]?.value);
  });

  it("redirects unauthenticated users from protected routes", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
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
    expect(result).toBe(redirectMock.mock.results[0]?.value);
  });

  it("allows authenticated users on protected routes", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
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
    expect(nextMock).toHaveBeenCalledOnce();
    expect(result).toBe(nextMock.mock.results[0]?.value);
  });
});

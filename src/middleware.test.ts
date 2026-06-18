import { beforeEach, describe, expect, it, vi } from "vitest";

const { nextMock, updateSessionMock } = vi.hoisted(() => ({
  nextMock: vi.fn((args?: { request?: unknown }) => ({
    kind: "next",
    request: args?.request,
  })),
  updateSessionMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
  },
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

import { middleware } from "../middleware";

type MiddlewareRequest = Parameters<typeof middleware>[0];

function createRequest(pathname: string, search = "") {
  return {
    method: "GET",
    nextUrl: {
      pathname,
      search,
    },
  } as unknown as MiddlewareRequest;
}

describe("root middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips auth middleware for framework and static asset routes", async () => {
    const request = createRequest("/_next/static/chunks/app.js");

    const result = await middleware(request);

    expect(nextMock).toHaveBeenCalledOnce();
    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "next", request: undefined });
  });

  it("skips auth middleware for api routes", async () => {
    const request = createRequest("/api/auth/context");

    const result = await middleware(request);

    expect(nextMock).toHaveBeenCalledOnce();
    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "next", request: undefined });
  });

  it("delegates non-static routes to updateSession", async () => {
    const request = createRequest("/customer/dashboard");
    updateSessionMock.mockResolvedValue({ kind: "updated" });

    const result = await middleware(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(result).toEqual({ kind: "updated" });
  });
});

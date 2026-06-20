import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { GET } from "./route";

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
};

type Chain = {
  select: (..._args: unknown[]) => Chain;
  eq: (field: string, value: unknown) => Chain;
  maybeSingle: () => Promise<QueryResult>;
  order: (..._args: unknown[]) => Chain;
  limit: (..._args: unknown[]) => Chain;
  in: (..._args: unknown[]) => Chain;
  then: <T>(
    onFulfilled?: ((value: QueryResult) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ) => Promise<T>;
};

function createChain(
  result: QueryResult,
  eqFilters?: Record<string, unknown>,
  isMaybeSingle?: boolean,
): Chain {
  const hasFilters = eqFilters && Object.keys(eqFilters).length > 0;
  let filteredData = result.data;

  if (hasFilters && Array.isArray(result.data)) {
    const matches = (result.data as Array<Record<string, unknown>>).filter(
      (item) =>
        Object.entries(eqFilters!).every(([key, value]) => item[key] === value),
    );
    filteredData = isMaybeSingle ? (matches[0] ?? null) : matches;
  }

  const resolved: QueryResult = {
    data:
      isMaybeSingle && Array.isArray(filteredData)
        ? (filteredData[0] ?? null)
        : filteredData,
    error: result.error ?? null,
  };

  const chain: Chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => resolved,
    order: () => chain,
    limit: () => chain,
    in: () => chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  const eqFiltersCopy = { ...eqFilters };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((field: string, value: unknown) => {
    eqFiltersCopy[field] = value;
    return createChain(result, eqFiltersCopy, true);
  });
  chain.maybeSingle = vi.fn(async () => {
    let data = resolved.data;
    if (Array.isArray(data) && data.length > 0) {
      data = data[0];
    } else if (Array.isArray(data)) {
      data = null;
    }
    return {
      data,
      error: resolved.error,
    };
  });
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);

  return chain;
}

function createAdminClient(results: Record<string, QueryResult>) {
  const chains = Object.fromEntries(
    Object.entries(results).map(([table, result]) => [
      table,
      createChain(result),
    ]),
  );

  return {
    from: vi.fn(
      (table: string) =>
        chains[table] ?? createChain({ data: [], error: null }),
    ),
  };
}

describe("GET /api/admin/users-roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects anonymous users", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });

    const response = await GET();

    expect(response!.status).toBe(401);
    await expect(response!.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("rejects non-admin users", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "staff-1" } } })),
      },
    });

    const adminClient = createAdminClient({
      user_profiles: { data: { role: "staff" }, error: null },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response!.status).toBe(403);
    await expect(response!.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns user roster metrics and rows", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    const now = new Date().toISOString();
    const recentLogin = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const adminClient = createAdminClient({
      user_profiles: {
        data: [
          {
            user_id: "admin-1",
            organization_id: "org-admin",
            full_name: "Alice Admin",
            email: "alice@blubook.test",
            role: "admin",
            membership_status: "active",
            last_login_at: recentLogin,
            activated_at: now,
            created_at: now,
            updated_at: now,
          },
          {
            user_id: "partner-1",
            organization_id: "org-partner",
            full_name: "Bob Partner",
            email: "bob@partner.test",
            role: "partner",
            membership_status: "active",
            last_login_at: null,
            activated_at: null,
            created_at: now,
            updated_at: now,
          },
        ],
        error: null,
      },
      organizations: {
        data: [
          { id: "org-admin", name: "BluBook Admin", kind: "admin" },
          { id: "org-partner", name: "Partner Co", kind: "partner" },
        ],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.metrics.total).toBe(2);
    expect(body.metrics.byRole.admin).toBe(1);
    expect(body.metrics.byRole.partner).toBe(1);
    expect(body.metrics.recentlyActive).toBe(1);
    expect(body.users[0]).toMatchObject({
      userId: "admin-1",
      email: "alice@blubook.test",
      role: "admin",
      organizationName: "BluBook Admin",
      organizationKind: "admin",
    });
    expect(body.users[1]).toMatchObject({
      userId: "partner-1",
      role: "partner",
      organizationName: "Partner Co",
      lastLoginAt: null,
    });
  });
});

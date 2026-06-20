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

import { GET, PATCH } from "./route";

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
};

type Chain = {
  select: (..._args: unknown[]) => Chain;
  eq: (..._args: unknown[]) => Chain;
  maybeSingle: () => Promise<QueryResult>;
  order: (..._args: unknown[]) => Chain;
  limit: (..._args: unknown[]) => Chain;
  in: (..._args: unknown[]) => Chain;
  update: (..._args: unknown[]) => Chain;
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
    update: () => chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  const eqFiltersCopy = { ...eqFilters };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((field: string, value: unknown) => {
    eqFiltersCopy[field] = value;
    return createChain(result, eqFiltersCopy, false);
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
  chain.update = vi.fn(() => chain);

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

describe("/api/admin/roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET rejects anonymous users", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("GET returns roles payload for admin", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    const now = new Date().toISOString();
    const adminClient = createAdminClient({
      user_profiles: {
        data: [
          {
            user_id: "admin-1",
            organization_id: "org-1",
            full_name: "Alice Admin",
            email: "alice@blubook.test",
            role: "admin",
            membership_status: "active",
            last_login_at: now,
            created_at: now,
            updated_at: now,
          },
          {
            user_id: "staff-1",
            organization_id: "org-1",
            full_name: "Stan Staff",
            email: "stan@blubook.test",
            role: "staff",
            membership_status: "active",
            last_login_at: null,
            created_at: now,
            updated_at: now,
          },
        ],
        error: null,
      },
      organizations: {
        data: [{ id: "org-1", name: "BluBook HQ", kind: "admin" }],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.metrics.total).toBe(2);
    expect(body.metrics.byRole.admin).toBe(1);
    expect(body.metrics.byRole.staff).toBe(1);
    expect(body.availableRoles).toContain("admin");
    expect(body.users[0]).toMatchObject({
      email: "alice@blubook.test",
      role: "admin",
      organizationName: "BluBook HQ",
    });
  });

  it("PATCH rejects self-demotion from admin", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
        })),
      },
    });

    const adminClient = createAdminClient({
      user_profiles: {
        data: [
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            role: "admin",
          },
        ],
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(adminClient);

    const response = await PATCH(
      new Request("http://localhost/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          role: "staff",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        "You cannot remove your own admin role from this management screen.",
    });
  });

  it("PATCH updates role for another user", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
        })),
      },
    });

    const adminClient = createAdminClient({
      user_profiles: {
        data: [
          {
            user_id: "11111111-1111-4111-8111-111111111111",
            role: "admin",
          },
          {
            user_id: "22222222-2222-4222-8222-222222222222",
            role: "partner",
          },
        ],
        error: null,
      },
      organization_memberships: { data: null, error: null },
    });
    createAdminClientMock.mockReturnValue(adminClient);

    const response = await PATCH(
      new Request("http://localhost/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "22222222-2222-4222-8222-222222222222",
          role: "staff",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: "22222222-2222-4222-8222-222222222222",
      previousRole: "partner",
      role: "staff",
      changed: true,
      membershipSynced: true,
    });
  });
});

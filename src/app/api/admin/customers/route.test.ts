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
  count?: number | null;
};

type QueryChain = {
  select: (..._args: unknown[]) => QueryChain;
  eq: (..._args: unknown[]) => QueryChain;
  maybeSingle: () => Promise<QueryResult>;
  order: (..._args: unknown[]) => QueryChain;
  in: (..._args: unknown[]) => QueryChain;
  then: <T>(
    onFulfilled?: ((value: QueryResult) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ) => Promise<T>;
};

function createChain(result: QueryResult): QueryChain {
  const resolved: QueryResult = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const chain: QueryChain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => resolved,
    order: () => chain,
    in: () => chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => resolved);
  chain.order = vi.fn(() => chain);
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

describe("GET /api/admin/customers", () => {
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
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
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

  it("returns aggregated customer activity", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    const adminClient = createAdminClient({
      user_profiles: { data: { role: "admin" }, error: null },
      organizations: {
        data: [
          {
            id: "org-1",
            name: "Acme Customer",
            slug: "acme-customer",
            status: "active",
            primary_contact_email: "ops@acme.test",
            updated_at: "2026-06-18T12:00:00.000Z",
          },
          {
            id: "org-2",
            name: "Beta Customer",
            slug: "beta-customer",
            status: "active",
            primary_contact_email: "ops@beta.test",
            updated_at: "2026-06-18T11:00:00.000Z",
          },
        ],
        error: null,
      },
      sales_orders: {
        data: [
          { organization_id: "org-1", status: "in_progress" },
          { organization_id: "org-1", status: "delivered" },
          { organization_id: "org-2", status: "order_completed" },
        ],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({
      customers: [
        {
          id: "org-1",
          name: "Acme Customer",
          slug: "acme-customer",
          status: "active",
          primaryContactEmail: "ops@acme.test",
          activeOrders: 1,
          completedOrders: 1,
          updatedAt: "2026-06-18T12:00:00.000Z",
        },
        {
          id: "org-2",
          name: "Beta Customer",
          slug: "beta-customer",
          status: "active",
          primaryContactEmail: "ops@beta.test",
          activeOrders: 0,
          completedOrders: 1,
          updatedAt: "2026-06-18T11:00:00.000Z",
        },
      ],
    });
  });
});


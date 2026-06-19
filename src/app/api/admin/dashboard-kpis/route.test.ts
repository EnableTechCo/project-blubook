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
  eq: (..._args: unknown[]) => Chain;
  maybeSingle: () => Promise<QueryResult>;
  limit: (..._args: unknown[]) => Chain;
  then: <T>(
    onFulfilled?: ((value: QueryResult) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ) => Promise<T>;
};

function createChain(result: QueryResult): Chain {
  const resolved: QueryResult = {
    data: result.data ?? null,
    error: result.error ?? null,
  };

  const chain: Chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => resolved,
    limit: () => chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => resolved);
  chain.limit = vi.fn(() => chain);

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

describe("GET /api/admin/dashboard-kpis", () => {
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
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns KPI cards", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    const now = Date.now();
    const inRange = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    const adminClient = createAdminClient({
      user_profiles: {
        data: { role: "admin" },
        error: null,
      },
      sales_orders: {
        data: [
          { status: "delivered", created_at: inRange },
          { status: "in_progress", created_at: inRange },
        ],
        error: null,
      },
      workflow_events_queue: {
        data: [
          { status: "queued", created_at: inRange },
          { status: "failed", created_at: inRange },
        ],
        error: null,
      },
      provider_workflow_handoffs: {
        data: [{ status: "assigned", assigned_at: inRange }],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.cards)).toBe(true);
    expect(body.cards).toHaveLength(4);
    expect(body.cards[0]).toHaveProperty("drillDownHref");
    expect(body.cards[0]).toHaveProperty("formula");
  });
});

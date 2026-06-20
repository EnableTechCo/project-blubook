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
  order: (..._args: unknown[]) => Chain;
  limit: (..._args: unknown[]) => Chain;
  in: (..._args: unknown[]) => Chain;
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
    order: () => chain,
    limit: () => chain,
    in: () => chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => resolved);
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

describe("GET /api/admin/sales-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects anonymous users", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });

    const response = await GET(
      new Request("http://localhost/api/admin/sales-pipeline"),
    );

    expect(response!.status).toBe(401);
    await expect(response!.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns sales pipeline metrics and status distribution", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    const adminClient = createAdminClient({
      user_profiles: {
        data: { role: "admin" },
        error: null,
      },
      sales_orders: {
        data: [
          {
            id: "order-1",
            status: "in_progress",
            total_cents: 150000,
            currency_code: "ZAR",
            po_reference: "PO-101",
            organization_id: "org-1",
            created_at: "2026-06-16T10:00:00.000Z",
            updated_at: "2026-06-16T10:00:00.000Z",
          },
          {
            id: "order-2",
            status: "delivered",
            total_cents: 90000,
            currency_code: "ZAR",
            po_reference: "PO-102",
            organization_id: "org-2",
            created_at: "2026-06-18T09:00:00.000Z",
            updated_at: "2026-06-18T09:00:00.000Z",
          },
        ],
        error: null,
      },
      organizations: {
        data: [
          { id: "org-1", name: "Acme Customer" },
          { id: "org-2", name: "Beta Customer" },
        ],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET(
      new Request("http://localhost/api/admin/sales-pipeline"),
    );

    expect(response!.status).toBe(200);

    const body = await response!.json();
    expect(body.metrics.total).toBe(2);
    expect(body.metrics.active).toBe(1);
    expect(body.metrics.completed).toBe(1);
    expect(body.byStatus.in_progress).toBe(1);
    expect(body.byStatus.delivered).toBe(1);
    expect(body.orders).toEqual([
      {
        id: "order-1",
        status: "in_progress",
        totalCents: 150000,
        currencyCode: "ZAR",
        poReference: "PO-101",
        customerName: "Acme Customer",
        createdAt: "2026-06-16T10:00:00.000Z",
        updatedAt: "2026-06-16T10:00:00.000Z",
      },
      {
        id: "order-2",
        status: "delivered",
        totalCents: 90000,
        currencyCode: "ZAR",
        poReference: "PO-102",
        customerName: "Beta Customer",
        createdAt: "2026-06-18T09:00:00.000Z",
        updatedAt: "2026-06-18T09:00:00.000Z",
      },
    ]);
  });
});

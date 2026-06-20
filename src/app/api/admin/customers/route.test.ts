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
  eq: (field: string, value: unknown) => QueryChain;
  maybeSingle: () => Promise<QueryResult>;
  order: (..._args: unknown[]) => QueryChain;
  in: (field: string, values: unknown[]) => QueryChain;
  then: <T>(
    onFulfilled?: ((value: QueryResult) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null,
  ) => Promise<T>;
};

function createChain(
  result: QueryResult,
  eqFilters?: Record<string, unknown>,
  inFilters?: Record<string, unknown[]>,
  isMaybeSingle?: boolean,
): QueryChain {
  const hasEqFilters = eqFilters && Object.keys(eqFilters).length > 0;
  const hasInFilters = inFilters && Object.keys(inFilters).length > 0;

  let filteredData = result.data;
  if ((hasEqFilters || hasInFilters) && Array.isArray(result.data)) {
    filteredData = (result.data as Array<Record<string, unknown>>).filter(
      (item) => {
        // Check eq filters
        if (hasEqFilters) {
          const eqMatch = Object.entries(eqFilters!).every(
            ([key, value]) => item[key] === value,
          );
          if (!eqMatch) return false;
        }
        // Check in filters
        if (hasInFilters) {
          const inMatch = Object.entries(inFilters!).every(([key, values]) =>
            values.includes(item[key] as string),
          );
          if (!inMatch) return false;
        }
        return true;
      },
    );
  }

  // For maybeSingle, convert array to single object
  const dataForResponse =
    isMaybeSingle && Array.isArray(filteredData)
      ? (filteredData[0] ?? null)
      : filteredData;

  const resolved: QueryResult = {
    data: dataForResponse,
    error: result.error ?? null,
    count: Array.isArray(filteredData)
      ? filteredData.length
      : (result.count ?? null),
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

  const eqFiltersCopy = eqFilters ? { ...eqFilters } : {};
  const inFiltersCopy = inFilters ? { ...inFilters } : {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((field: string, value: unknown) => {
    eqFiltersCopy[field] = value;
    return createChain(result, eqFiltersCopy, inFiltersCopy, false);
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
  chain.in = vi.fn((field: string, values: unknown[]) => {
    const newInFilters = { ...inFiltersCopy, [field]: values as unknown[] };
    return createChain(result, eqFiltersCopy, newInFilters, false);
  });

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
      user_profiles: {
        data: [
          {
            user_id: "user-1",
            role: "staff",
          },
        ],
        error: null,
      },
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
      user_profiles: {
        data: [
          {
            user_id: "admin-1",
            role: "admin",
          },
        ],
        error: null,
      },
      organizations: {
        data: [
          {
            id: "org-1",
            kind: "customer",
            name: "Acme Customer",
            slug: "acme-customer",
            status: "active",
            primary_contact_email: "ops@acme.test",
            updated_at: "2026-06-18T12:00:00.000Z",
          },
          {
            id: "org-2",
            kind: "customer",
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
          {
            organization_id: "org-1",
            status: "in_progress",
            total_cents: 5000,
            currency_code: "ZAR",
            updated_at: "2026-06-18T12:00:00.000Z",
          },
          {
            organization_id: "org-1",
            status: "delivered",
            total_cents: 3000,
            currency_code: "ZAR",
            updated_at: "2026-06-18T12:00:00.000Z",
          },
          {
            organization_id: "org-2",
            status: "order_completed",
            total_cents: 2000,
            currency_code: "ZAR",
            updated_at: "2026-06-18T11:00:00.000Z",
          },
        ],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.summary.total).toBe(2);
    expect(body.customers).toHaveLength(2);
    expect(body.customers[0]).toMatchObject({
      id: "org-1",
      name: "Acme Customer",
      slug: "acme-customer",
      status: "active",
      primaryContactEmail: "ops@acme.test",
      activeOrders: 1,
      completedOrders: 1,
      updatedAt: "2026-06-18T12:00:00.000Z",
    });
    expect(body.customers[1]).toMatchObject({
      id: "org-2",
      name: "Beta Customer",
      slug: "beta-customer",
      status: "active",
      primaryContactEmail: "ops@beta.test",
      activeOrders: 0,
      completedOrders: 1,
      updatedAt: "2026-06-18T11:00:00.000Z",
    });
  });
});

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

type Chain = {
  select: (..._args: unknown[]) => Chain;
  eq: (..._args: unknown[]) => Chain;
  ilike: (..._args: unknown[]) => Chain;
  maybeSingle: () => Promise<QueryResult>;
  order: (..._args: unknown[]) => Chain;
  limit: (..._args: unknown[]) => Chain;
  range: (..._args: unknown[]) => Chain;
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
    count: typeof result.count === "number" ? result.count : null,
  };

  const chain: Chain = {
    select: () => chain,
    eq: () => chain,
    ilike: () => chain,
    maybeSingle: async () => resolved,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    in: () => chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  const eqFiltersCopy = { ...eqFilters };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((field: string, value: unknown) => {
    eqFiltersCopy[field] = value;
    return createChain(result, eqFiltersCopy, false);
  });
  chain.ilike = vi.fn(() => chain);
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
  chain.range = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);

  return chain;
}

function createAdminClient(
  results: Record<string, QueryResult | QueryResult[]>,
) {
  const callCountByTable = new Map<string, number>();

  return {
    from: vi.fn((table: string) => {
      const calls = callCountByTable.get(table) ?? 0;
      callCountByTable.set(table, calls + 1);

      const configured = results[table];
      if (!configured) {
        return createChain({ data: [], error: null });
      }

      if (Array.isArray(configured)) {
        const result = configured[Math.min(calls, configured.length - 1)] ?? {
          data: [],
          error: null,
        };
        return createChain(result);
      }

      return createChain(configured);
    }),
  };
}

describe("GET /api/admin/documents", () => {
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
      new Request("http://localhost/api/admin/documents"),
    );

    expect(response!.status).toBe(401);
    await expect(response!.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns document metrics and rows", async () => {
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
          {
            user_id: "user-1",
            full_name: "Jane Uploader",
            email: "jane@example.com",
          },
        ],
        error: null,
      },
      documents: {
        data: [
          {
            id: "doc-1",
            organization_id: "org-1",
            request_id: null,
            uploaded_by: "user-1",
            bucket: "private",
            path: "partners/sp-1/proof-of-delivery.pdf",
            file_name: "proof-of-delivery.pdf",
            mime_type: "application/pdf",
            size_bytes: 102400,
            metadata: { documentType: "proof-of-delivery" },
            created_at: "2026-06-18T12:00:00.000Z",
            updated_at: "2026-06-18T12:00:00.000Z",
          },
        ],
        error: null,
        count: 1,
      },
      customer_requirement_evidence: {
        data: [],
        error: null,
      },
      purchase_orders: {
        data: [],
        error: null,
      },
      organizations: {
        data: [{ id: "org-1", name: "Acme Customer" }],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET(
      new Request("http://localhost/api/admin/documents?page=1&pageSize=25"),
    );

    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.metrics.total).toBe(1);
    expect(body.metrics.pageCount).toBe(1);
    expect(body.metrics.totalSizeBytes).toBe(102400);
    expect(body.metrics.byMimeType["application/pdf"]).toBe(1);
    expect(body.metrics.byGroup["delivery-docs"]).toBe(1);
    expect(body.pagination.totalPages).toBe(1);
    expect(body.documents[0]).toMatchObject({
      id: "doc-1",
      fileName: "proof-of-delivery.pdf",
      documentType: "proof-of-delivery",
      groupKey: "delivery-docs",
      groupLabel: "Delivery Docs",
      organizationName: "Acme Customer",
    });
  });
});

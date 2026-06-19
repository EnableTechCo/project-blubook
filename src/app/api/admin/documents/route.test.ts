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

    const response = await GET();

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
        data: { role: "admin" },
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
      },
      organizations: {
        data: [{ id: "org-1", name: "Acme Customer" }],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.metrics.total).toBe(1);
    expect(body.metrics.totalSizeBytes).toBe(102400);
    expect(body.metrics.byMimeType["application/pdf"]).toBe(1);
    expect(body.documents[0]).toMatchObject({
      id: "doc-1",
      fileName: "proof-of-delivery.pdf",
      documentType: "proof-of-delivery",
      organizationName: "Acme Customer",
    });
  });
});


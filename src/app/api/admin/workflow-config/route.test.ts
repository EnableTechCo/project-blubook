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
  update: (..._args: unknown[]) => Chain;
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
    update: () => chain,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => resolved);
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

describe("/api/admin/workflow-config", () => {
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

  it("GET returns default config when metadata has no workflow_config", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    const adminClient = createAdminClient({
      user_profiles: {
        data: { role: "admin", organization_id: "org-1" },
        error: null,
      },
      organizations: {
        data: { id: "org-1", metadata: {} },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.organizationId).toBe("org-1");
    expect(body.config.guardrails.strictTransitionValidation).toBe(true);
    expect(body.config.defaultAssignments.sales).toBe("sales");
  });

  it("PATCH rejects invalid transition target", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    const adminClient = createAdminClient({
      user_profiles: {
        data: { role: "admin", organization_id: "org-1" },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(adminClient);

    const response = await PATCH(
      new Request("http://localhost/api/admin/workflow-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transitions: {
            sales: {
              "Purchase Order Received": ["NOT_A_REAL_STATE"],
            },
            logistics: {
              "Order Received": ["Order Transmitted to Warehouse"],
            },
          },
          defaultAssignments: {
            sales: "sales",
            logistics: "logistics",
          },
          guardrails: {
            strictTransitionValidation: true,
            requireReasonOnManualOverride: true,
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("missing state");
  });
});

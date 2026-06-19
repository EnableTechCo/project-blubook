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

describe("GET /api/admin/audit-logs", () => {
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
      new Request("http://localhost/api/admin/audit-logs"),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns aggregated audit payload", async () => {
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
            user_id: "actor-1",
            full_name: "Alice Admin",
            email: "alice@blubook.test",
          },
          {
            user_id: "actor-2",
            full_name: "Sam Staff",
            email: "sam@blubook.test",
          },
        ],
        error: null,
      },
      automation_decisions: {
        data: [
          {
            id: "dec-1",
            organization_id: "org-1",
            profile_id: "actor-1",
            source: "ai",
            recommended_priority: "high",
            recommended_stream: "Logistics",
            recommendation_json: { partner_id: "sp-1" },
            explanation: "Assign to logistics partner.",
            status: "pending",
            created_at: now,
          },
        ],
        error: null,
      },
      automation_overrides: {
        data: [
          {
            id: "ovr-1",
            decision_id: "dec-1",
            overridden_by: "actor-2",
            previous_priority: "high",
            new_priority: "critical",
            reason: "Urgent compliance requirement.",
            metadata: {
              previous_partner_id: "sp-1",
              new_partner_id: "sp-2",
            },
            created_at: now,
          },
        ],
        error: null,
      },
      onboarding_anomaly_alerts: {
        data: [
          {
            id: "anom-1",
            organization_id: "org-1",
            onboarding_submission_id: "sub-1",
            profile_id: "actor-1",
            anomaly_type: "low_confidence_profile",
            reason: "Profile confidence below threshold.",
            severity: "medium",
            status: "pending_review",
            reviewed_by: null,
            reviewed_at: null,
            created_at: now,
          },
        ],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET(
      new Request("http://localhost/api/admin/audit-logs?page=1&limit=20"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.pagination.total).toBe(3);
    expect(body.metrics.byModule.routing).toBe(2);
    expect(body.metrics.byModule.onboarding).toBe(1);
    expect(body.logs[0]).toHaveProperty("action");
    expect(body.logs[0]).toHaveProperty("summary");
    expect(body.options.modules).toContain("routing");
    expect(body.options.modules).toContain("onboarding");
  });
});

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

describe("GET /api/admin/logistics-handoffs", () => {
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
      new Request("http://localhost/api/admin/logistics-handoffs"),
    );

    expect(response!.status).toBe(401);
    await expect(response!.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns logistics handoff metrics and rows", async () => {
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
      provider_workflow_handoffs: {
        data: [
          {
            id: "h-1",
            sales_order_id: "order-1",
            order_item_id: "item-1",
            from_provider_id: "sp-1",
            to_provider_id: "sp-2",
            status: "pending",
            handoff_type: "sales_to_logistics",
            package_stream: "Logistics",
            assigned_at: "2026-06-18T12:00:00.000Z",
            completed_at: null,
          },
          {
            id: "h-2",
            sales_order_id: "order-2",
            order_item_id: "item-2",
            from_provider_id: "sp-1",
            to_provider_id: "sp-3",
            status: "completed",
            handoff_type: "sales_to_logistics",
            package_stream: "Logistics",
            assigned_at: "2026-06-18T10:00:00.000Z",
            completed_at: "2026-06-18T11:00:00.000Z",
          },
        ],
        error: null,
      },
      sales_orders: {
        data: [
          { id: "order-1", po_reference: "PO-001", status: "in_progress" },
          { id: "order-2", po_reference: "PO-002", status: "delivered" },
        ],
        error: null,
      },
      service_partners: {
        data: [
          { id: "sp-1", name: "Blue Sales" },
          { id: "sp-2", name: "Rapid Logistics" },
          { id: "sp-3", name: "Metro Couriers" },
        ],
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET(
      new Request("http://localhost/api/admin/logistics-handoffs"),
    );

    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({
      metrics: {
        total: 2,
        pending: 1,
        accepted: 0,
        inProgress: 0,
        completed: 1,
      },
      handoffs: [
        {
          id: "h-1",
          salesOrderId: "order-1",
          orderItemId: "item-1",
          status: "pending",
          handoffType: "sales_to_logistics",
          packageStream: "Logistics",
          assignedAt: "2026-06-18T12:00:00.000Z",
          completedAt: null,
          poReference: "PO-001",
          salesOrderStatus: "in_progress",
          fromProviderName: "Blue Sales",
          toProviderName: "Rapid Logistics",
        },
        {
          id: "h-2",
          salesOrderId: "order-2",
          orderItemId: "item-2",
          status: "completed",
          handoffType: "sales_to_logistics",
          packageStream: "Logistics",
          assignedAt: "2026-06-18T10:00:00.000Z",
          completedAt: "2026-06-18T11:00:00.000Z",
          poReference: "PO-002",
          salesOrderStatus: "delivered",
          fromProviderName: "Blue Sales",
          toProviderName: "Metro Couriers",
        },
      ],
    });
  });
});

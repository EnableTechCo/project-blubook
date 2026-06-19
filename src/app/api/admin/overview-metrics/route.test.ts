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
  count?: number | null;
  error?: { message: string } | null;
};

function createOverviewAdminClient(input: {
  role: string;
  orderStatuses: string[];
  counts: {
    partners: number;
    customers: number;
    queueFailed: number;
    queueQueued: number;
    staleHandoffs: number;
  };
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        const result: QueryResult = {
          data: { role: input.role },
          error: null,
        };

        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => result),
        };

        return chain;
      }

      if (table === "sales_orders") {
        return {
          select: vi.fn(async () => ({
            data: input.orderStatuses.map((status) => ({ status })),
            error: null,
          })),
        };
      }

      if (table === "organizations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async (_column: string, value: string) => ({
              count:
                value === "partner"
                  ? input.counts.partners
                  : input.counts.customers,
              error: null,
            })),
          })),
        };
      }

      if (table === "workflow_events_queue") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async (_column: string, value: string) => ({
              count:
                value === "failed"
                  ? input.counts.queueFailed
                  : input.counts.queueQueued,
              error: null,
            })),
          })),
        };
      }

      if (table === "provider_workflow_handoffs") {
        return {
          select: vi.fn(() => ({
            neq: vi.fn(() => ({
              lt: vi.fn(async () => ({
                count: input.counts.staleHandoffs,
                error: null,
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(async () => ({ data: null, error: null })),
      };
    }),
  };
}

describe("GET /api/admin/overview-metrics", () => {
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

  it("returns db-backed overview metrics and alerts", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    createAdminClientMock.mockReturnValue(
      createOverviewAdminClient({
        role: "admin",
        orderStatuses: ["in_progress", "delivered", "order_completed"],
        counts: {
          partners: 5,
          customers: 9,
          queueFailed: 2,
          queueQueued: 4,
          staleHandoffs: 1,
        },
      }),
    );

    const response = await GET();

    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({
      metrics: {
        activeOrders: 1,
        completedOrders: 2,
        activePartners: 5,
        activeCustomers: 9,
        queueFailed: 2,
        queueQueued: 4,
        staleHandoffs: 1,
      },
      alerts: [
        "2 failed workflow queue events require attention.",
        "1 handoffs are stale for more than 24h.",
      ],
    });
  });
});


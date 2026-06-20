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

type QueueEvent = {
  id: string;
  event_type: string;
  status: string;
  scheduled_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
};

type QueryResult = {
  data?: unknown;
  count?: number | null;
  error?: { message: string } | null;
};

function createDispatchAdminClient(input: {
  role: string;
  events: QueueEvent[];
  counts: Record<string, number>;
}) {
  const profileResult: QueryResult = {
    data: { role: input.role },
    error: null,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        const result = profileResult;
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => result),
        };
        return chain;
      }

      if (table === "workflow_events_queue") {
        const query = {
          select: vi.fn(
            (
              _columns: string,
              options?: { count?: "exact"; head?: boolean },
            ) => {
              if (options?.head) {
                return {
                  eq: vi.fn(async (_column: string, status: string) => ({
                    count: input.counts[status] ?? 0,
                    error: null,
                  })),
                };
              }

              const chain = {
                order: vi.fn(() => chain),
                limit: vi.fn(async () => ({
                  data: input.events,
                  error: null,
                })),
              };

              return chain;
            },
          ),
        };

        return query;
      }

      return {
        select: vi.fn(async () => ({ data: null, error: null })),
      };
    }),
  };
}

describe("GET /api/admin/dispatch-queue", () => {
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
      new Request("http://localhost/api/admin/dispatch-queue"),
    );

    expect(response!.status).toBe(401);
    await expect(response!.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns queue metrics and recent events", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
    });

    createAdminClientMock.mockReturnValue(
      createDispatchAdminClient({
        role: "admin",
        events: [
          {
            id: "evt-1",
            event_type: "workflow/po_uploaded",
            status: "queued",
            scheduled_at: "2026-06-18T10:00:00.000Z",
            processed_at: null,
            created_at: "2026-06-18T10:00:00.000Z",
            updated_at: "2026-06-18T10:00:00.000Z",
            error_message: null,
          },
        ],
        counts: {
          queued: 3,
          processing: 1,
          completed: 12,
          failed: 2,
        },
      }),
    );

    const response = await GET(
      new Request("http://localhost/api/admin/dispatch-queue"),
    );

    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({
      metrics: {
        queued: 3,
        processing: 1,
        completed: 12,
        failed: 2,
      },
      events: [
        {
          id: "evt-1",
          event_type: "workflow/po_uploaded",
          status: "queued",
          scheduled_at: "2026-06-18T10:00:00.000Z",
          processed_at: null,
          created_at: "2026-06-18T10:00:00.000Z",
          updated_at: "2026-06-18T10:00:00.000Z",
          error_message: null,
        },
      ],
    });
  });
});

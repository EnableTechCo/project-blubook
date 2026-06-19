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

describe("GET /api/admin/work-orders", () => {
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

  it("returns work order metrics and rows", async () => {
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
      work_orders: {
        data: [
          {
            id: "wo-1",
            order_item_id: "item-1",
            status: "pending",
            quantity_to_build: 12,
            completed_at: null,
            created_at: "2026-06-18T09:00:00.000Z",
            updated_at: "2026-06-18T10:00:00.000Z",
          },
          {
            id: "wo-2",
            order_item_id: "item-2",
            status: "completed",
            quantity_to_build: 4,
            completed_at: "2026-06-18T11:00:00.000Z",
            created_at: "2026-06-18T09:00:00.000Z",
            updated_at: "2026-06-18T11:00:00.000Z",
          },
        ],
        error: null,
      },
      sales_order_items: {
        data: [
          {
            id: "item-1",
            order_id: "order-1",
            product_name: "Widget A",
            sku: "W-A",
            quantity: 12,
          },
          {
            id: "item-2",
            order_id: "order-2",
            product_name: "Widget B",
            sku: "W-B",
            quantity: 4,
          },
        ],
        error: null,
      },
      sales_orders: {
        data: [
          {
            id: "order-1",
            po_reference: "PO-1001",
            status: "in_progress",
            organization_id: "org-1",
          },
          {
            id: "order-2",
            po_reference: "PO-1002",
            status: "order_completed",
            organization_id: "org-2",
          },
        ],
        error: null,
      },
      organizations: {
        data: [
          { id: "org-1", name: "Acme" },
          { id: "org-2", name: "Beta" },
        ],
        error: null,
      },
      purchase_orders: {
        data: [
          {
            id: "po-1",
            sales_order_id: "order-1",
            customer_document_id: "doc-1",
            po_number: "PO-1001",
          },
          {
            id: "po-2",
            sales_order_id: "order-2",
            customer_document_id: null,
            po_number: "PO-1002",
          },
        ],
        error: null,
      },
      documents: {
        data: [
          {
            id: "doc-1",
            bucket: "customer-documents",
            path: "org-1/po-1001.pdf",
            file_name: "po-1001.pdf",
          },
        ],
        error: null,
      },
    });

    (adminClient as { storage?: unknown }).storage = {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://example.test/po-1001.pdf" },
        })),
      })),
    };

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response!.status).toBe(200);
    await expect(response!.json()).resolves.toEqual({
      metrics: {
        total: 2,
        active: 1,
        completed: 1,
        blocked: 0,
      },
      workOrders: [
        {
          id: "wo-1",
          status: "pending",
          quantityToBuild: 12,
          completedAt: null,
          createdAt: "2026-06-18T09:00:00.000Z",
          updatedAt: "2026-06-18T10:00:00.000Z",
          source: "work_order",
          packageStream: null,
          orderItemId: "item-1",
          productName: "Widget A",
          sku: "W-A",
          itemQuantity: 12,
          salesOrderId: "order-1",
          poReference: "PO-1001",
          salesOrderStatus: "in_progress",
          customerName: "Acme",
          poDocument: {
            fileName: "po-1001.pdf",
            signedUrl: "https://example.test/po-1001.pdf",
          },
        },
        {
          id: "wo-2",
          status: "completed",
          quantityToBuild: 4,
          completedAt: "2026-06-18T11:00:00.000Z",
          createdAt: "2026-06-18T09:00:00.000Z",
          updatedAt: "2026-06-18T11:00:00.000Z",
          source: "work_order",
          packageStream: null,
          orderItemId: "item-2",
          productName: "Widget B",
          sku: "W-B",
          itemQuantity: 4,
          salesOrderId: "order-2",
          poReference: "PO-1002",
          salesOrderStatus: "order_completed",
          customerName: "Beta",
          poDocument: null,
        },
      ],
    });
  });
});

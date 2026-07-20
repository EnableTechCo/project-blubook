import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createServerClientMock }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));

import { POST } from "./route";

type DepRow = { id: string; catalog_item_id: string; depends_on_item_id: string };

function mockClients(input: { role?: string; existingDeps?: DepRow[] } = {}) {
  createServerClientMock.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })) },
  });

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({
            data: input.role ? { role: input.role } : null,
            error: null,
          }),
        };
        return chain;
      }
      if (table === "catalog_item_dependencies") {
        return {
          // list (P1-5): .select(cols) resolves to existing edges
          select: () => ({
            then: (resolve: (v: unknown) => unknown) =>
              resolve({ data: input.existingDeps ?? [], error: null }),
          }),
          // insert path: .insert().select().single()
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "dep-new", catalog_item_id: "x", depends_on_item_id: "y" },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ then: (r: (v: unknown) => unknown) => r({ data: [], error: null }) }) };
    }),
  };
  createAdminClientMock.mockReturnValue(admin);
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/admin/catalog/dependencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/catalog/dependencies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a non-admin/staff user with 403", async () => {
    mockClients({ role: "customer" });
    const res = await POST(postRequest({ catalogItemId: crypto.randomUUID(), dependsOnItemId: crypto.randomUUID() }));
    expect(res!.status).toBe(403);
  });

  it("rejects a self-dependency with 409", async () => {
    const id = crypto.randomUUID();
    mockClients({ role: "admin" });
    const res = await POST(postRequest({ catalogItemId: id, dependsOnItemId: id }));
    expect(res!.status).toBe(409);
    await expect(res!.json()).resolves.toEqual({ error: "An item cannot depend on itself." });
  });

  it("rejects an edge that would create a cycle with 409", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    // Existing A->B; adding B->A closes a loop.
    mockClients({ role: "admin", existingDeps: [{ id: "e1", catalog_item_id: a, depends_on_item_id: b }] });
    const res = await POST(postRequest({ catalogItemId: b, dependsOnItemId: a }));
    expect(res!.status).toBe(409);
    await expect(res!.json()).resolves.toEqual({ error: "That dependency would create a cycle." });
  });

  it("creates a valid, acyclic dependency with 201", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const c = crypto.randomUUID();
    // Existing A->B; adding B->C does not close a loop.
    mockClients({ role: "admin", existingDeps: [{ id: "e1", catalog_item_id: a, depends_on_item_id: b }] });
    const res = await POST(postRequest({ catalogItemId: b, dependsOnItemId: c }));
    expect(res!.status).toBe(201);
  });
});

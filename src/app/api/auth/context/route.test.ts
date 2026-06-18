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

type QueryResult = { data?: unknown; error?: unknown };

type QueryChain = {
  select: () => QueryChain;
  eq: () => QueryChain;
  insert: () => QueryChain;
  update: () => QueryChain;
  upsert: () => QueryChain;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
};

function createChain(result: { data?: unknown; error?: unknown }) {
  const chain: QueryChain = {
    select: () => chain,
    eq: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    single: async () => result,
    maybeSingle: async () => result,
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.upsert = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);

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
      (table: string) => chains[table] ?? createChain({ data: null }),
    ),
  };
}

describe("GET /api/auth/context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects anonymous users", async () => {
    const getUser = vi.fn(async () => ({ data: { user: null } }));
    createServerClientMock.mockResolvedValue({ auth: { getUser } });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns organization context from the profile record", async () => {
    const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } } }));
    const adminClient = createAdminClient({
      user_profiles: { data: { organization_id: "org-1", role: "admin" } },
      organizations: { data: { name: "Acme Imports" } },
    });

    createServerClientMock.mockResolvedValue({ auth: { getUser } });
    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "user-1",
      organizationId: "org-1",
      organizationName: "Acme Imports",
      role: "admin",
    });
    expect(adminClient.from).toHaveBeenCalledWith("user_profiles");
    expect(adminClient.from).toHaveBeenCalledWith("organizations");
  });

  it("falls back to membership context when the profile has no organization", async () => {
    const getUser = vi.fn(async () => ({ data: { user: { id: "user-2" } } }));
    const adminClient = createAdminClient({
      user_profiles: { data: null },
      organization_memberships: {
        data: { organization_id: "org-2", role: "member" },
      },
      organizations: { data: { name: "Beta Logistics" } },
    });

    createServerClientMock.mockResolvedValue({ auth: { getUser } });
    createAdminClientMock.mockReturnValue(adminClient);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "user-2",
      organizationId: "org-2",
      organizationName: "Beta Logistics",
      role: "member",
    });
    expect(adminClient.from).toHaveBeenCalledWith("user_profiles");
    expect(adminClient.from).toHaveBeenCalledWith("organization_memberships");
    expect(adminClient.from).toHaveBeenCalledWith("organizations");
  });
});

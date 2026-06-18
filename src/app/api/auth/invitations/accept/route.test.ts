import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { POST } from "./route";

type QueryResult = { data?: unknown; error?: unknown };

type QueryChain = {
  select: () => QueryChain;
  eq: () => QueryChain;
  update: () => QueryChain;
  insert: () => QueryChain;
  upsert: () => QueryChain;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
};

function createChain(result: QueryResult) {
  const chain: QueryChain = {
    select: () => chain,
    eq: () => chain,
    update: () => chain,
    insert: () => chain,
    upsert: () => chain,
    single: async () => result,
    maybeSingle: async () => result,
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
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
    auth: {
      admin: {
        createUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    },
    from: vi.fn(
      (table: string) => chains[table] ?? createChain({ data: null }),
    ),
  };
}

function buildPayload() {
  return {
    token: "abcdefghijklmnopqrstuvwxyz123456",
    email: "invitee@example.com",
    password: "password123",
    fullName: "Jordan Invitee",
  };
}

describe("POST /api/auth/invitations/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates a valid invitation", async () => {
    const payload = buildPayload();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const adminClient = createAdminClient({
      invitations: {
        data: {
          id: "invite-1",
          email: payload.email,
          role: "partner",
          status: "pending",
          expires_at: expiresAt,
          organization_id: "org-1",
          membership_id: "membership-1",
        },
      },
      user_profiles: { data: null },
      organization_memberships: { data: null },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await POST(
      new Request("http://localhost/api/auth/invitations/accept", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(adminClient.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
      }),
    );
    expect(adminClient.from).toHaveBeenCalledWith("user_profiles");
    expect(adminClient.from).toHaveBeenCalledWith("organization_memberships");
    expect(adminClient.from).toHaveBeenCalledWith("invitations");
  });

  it("expires an old invitation", async () => {
    const payload = buildPayload();
    const adminClient = createAdminClient({
      invitations: {
        data: {
          id: "invite-1",
          email: payload.email,
          role: "partner",
          status: "pending",
          expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          organization_id: "org-1",
          membership_id: "membership-1",
        },
      },
    });

    createAdminClientMock.mockReturnValue(adminClient);

    const response = await POST(
      new Request("http://localhost/api/auth/invitations/accept", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invitation has expired.",
    });
  });
});

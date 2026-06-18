import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock, createAdminClientMock, queueEmailMock, dispatchQueuedEmailsMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  queueEmailMock: vi.fn(),
  dispatchQueuedEmailsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/email/dispatcher", () => ({
  queueEmail: queueEmailMock,
  dispatchQueuedEmails: dispatchQueuedEmailsMock,
}));

import { POST } from "./route";

function createChain(result: { data?: unknown; error?: unknown }) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);

  return chain;
}

function createAdminClient(results: Record<string, { data?: unknown; error?: unknown }>) {
  const chains = Object.fromEntries(
    Object.entries(results).map(([table, result]) => [table, createChain(result)]),
  );

  return {
    from: vi.fn((table: string) => chains[table] ?? createChain({ data: null })),
  };
}

function buildPayload() {
  return {
    email: "invitee@example.com",
    role: "partner" as const,
    fullName: "Jordan Partner",
    organizationName: "Jordan Logistics",
    expiresInHours: 24,
  };
}

describe("POST /api/auth/invitations/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("rejects unauthenticated requests", async () => {
    const getUser = vi.fn(async () => ({ data: { user: null } }));
    createServerClientMock.mockResolvedValue({ auth: { getUser } });

    const response = await POST(
      new Request("http://localhost/api/auth/invitations/send", {
        method: "POST",
        body: JSON.stringify(buildPayload()),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects users without admin or staff access", async () => {
    const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } } }));
    const adminClient = createAdminClient({
      user_profiles: { data: { role: "customer" } },
    });

    createServerClientMock.mockResolvedValue({ auth: { getUser } });
    createAdminClientMock.mockReturnValue(adminClient);

    const response = await POST(
      new Request("http://localhost/api/auth/invitations/send", {
        method: "POST",
        body: JSON.stringify(buildPayload()),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("creates the invitation and queues the email", async () => {
    const payload = buildPayload();
    const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } } }));
    const adminClient = createAdminClient({
      user_profiles: { data: { role: "admin" } },
      organizations: { data: { id: "org-1" } },
      organization_memberships: { data: { id: "membership-1" } },
      invitations: { data: { id: "invite-1" } },
    });

    createServerClientMock.mockResolvedValue({ auth: { getUser } });
    createAdminClientMock.mockReturnValue(adminClient);
    queueEmailMock.mockResolvedValue(undefined);
    dispatchQueuedEmailsMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/auth/invitations/send", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      ok: true,
      invitationId: "invite-1",
      expiresAt: expect.any(String),
    });
    expect(body.inviteLink).toContain("http://localhost/invite?token=");
    expect(body.inviteLink).toContain("email=invitee%40example.com");
    expect(body.inviteLink).toContain("name=Jordan%20Partner");
    expect(queueEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "partner-invite",
        toEmail: payload.email,
        organizationId: "org-1",
        invitationId: "invite-1",
      }),
    );
    expect(dispatchQueuedEmailsMock).toHaveBeenCalledWith(5);
  });
});
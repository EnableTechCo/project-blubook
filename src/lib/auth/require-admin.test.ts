import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const profileResult = { data: null as { role: string } | null, error: null };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => profileResult,
    };
    return { from: () => q };
  },
}));

import { requireAdminApi } from "./require-admin";

beforeEach(() => {
  getUser.mockReset();
  profileResult.data = null;
});

const signedInAs = (role: string | null) => {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  profileResult.data = role ? { role } : null;
};

describe("requireAdminApi", () => {
  it("401s an anonymous caller", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await requireAdminApi();

    expect(result.error?.status).toBe(401);
    expect(result.admin).toBeUndefined();
  });

  it("403s a signed-in customer", async () => {
    // The gap this guard closes: authenticated is not the same as authorised.
    signedInAs("customer");

    const result = await requireAdminApi();

    expect(result.error?.status).toBe(403);
    expect(result.admin).toBeUndefined();
  });

  it("403s a signed-in partner", async () => {
    signedInAs("partner");

    const result = await requireAdminApi();

    expect(result.error?.status).toBe(403);
  });

  it("403s a user with no profile", async () => {
    signedInAs(null);

    const result = await requireAdminApi();

    expect(result.error?.status).toBe(403);
  });

  it("admits an admin", async () => {
    signedInAs("admin");

    const result = await requireAdminApi();

    expect(result.error).toBeUndefined();
    expect(result.admin).toBeDefined();
    expect(result.userId).toBe("u1");
  });

  it("admits staff", async () => {
    signedInAs("staff");

    const result = await requireAdminApi();

    expect(result.error).toBeUndefined();
    expect(result.userId).toBe("u1");
  });
});

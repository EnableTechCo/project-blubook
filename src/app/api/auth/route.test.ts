import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/auth", () => {
  it("returns the auth scaffold message", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message:
        "Auth route scaffolded. Implement login/session flows using Supabase Auth callbacks.",
    });
  });
});
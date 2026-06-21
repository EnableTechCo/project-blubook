import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseApi } from "@/store/redux/api/base-api";
import { sessionApi } from "@/store/redux/api/session-api";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

describe("sessionApi", () => {
  const stores: Array<ReturnType<typeof configureStore>> = [];
  const subscriptions: Array<{ unsubscribe: () => void }> = [];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    subscriptions.splice(0).forEach((sub) => sub.unsubscribe());
    stores.splice(0).forEach((store) => {
      store.dispatch(baseApi.util.resetApiState());
    });
    vi.clearAllMocks();
  });

  it("resolves auth user from supabase", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    });

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (gdm) => gdm().concat(baseApi.middleware),
    });
    stores.push(store);

    const query = store.dispatch(sessionApi.endpoints.getAuthUser.initiate());
    subscriptions.push(query);
    const result = await query;

    expect("data" in result && result.data).toMatchObject({
      id: "user-1",
      email: "user@example.com",
    });
  });

  it("normalizes customer context from auth context response", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          organizationId: "org-1",
          organizationName: "Org One",
          role: "customer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (gdm) => gdm().concat(baseApi.middleware),
    });
    stores.push(store);

    const query = store.dispatch(
      sessionApi.endpoints.getCustomerContext.initiate("user-1"),
    );
    subscriptions.push(query);
    const result = await query;

    expect(fetchMock).toHaveBeenCalled();
    expect("data" in result && result.data).toEqual({
      userId: "user-1",
      email: "",
      fullName: null,
      role: "customer",
      organizationId: "org-1",
      organizationName: "Org One",
    });
  });
});

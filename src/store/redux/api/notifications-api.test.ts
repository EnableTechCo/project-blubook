import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseApi } from "@/store/redux/api/base-api";
import { notificationsApi } from "@/store/redux/api/notifications-api";

const listNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();
const markNotificationsReadMock = vi.fn();
const markAllNotificationsReadMock = vi.fn();

vi.mock("@/services/notifications.service", () => ({
  listNotifications: (...args: unknown[]) => listNotificationsMock(...args),
  markNotificationRead: (...args: unknown[]) =>
    markNotificationReadMock(...args),
  markNotificationsRead: (...args: unknown[]) =>
    markNotificationsReadMock(...args),
  markAllNotificationsRead: (...args: unknown[]) =>
    markAllNotificationsReadMock(...args),
}));

describe("notificationsApi", () => {
  const stores: Array<ReturnType<typeof configureStore>> = [];
  const subscriptions: Array<{ unsubscribe: () => void }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    subscriptions.splice(0).forEach((sub) => sub.unsubscribe());
    stores.splice(0).forEach((store) => {
      store.dispatch(baseApi.util.resetApiState());
    });
    vi.restoreAllMocks();
  });

  it("loads notifications for user", async () => {
    listNotificationsMock.mockResolvedValue([
      {
        id: "n1",
        user_id: "u1",
        message: "Hello",
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ]);

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (gdm) => gdm().concat(baseApi.middleware),
    });
    stores.push(store);

    const query = store.dispatch(
      notificationsApi.endpoints.listNotifications.initiate("u1"),
    );
    subscriptions.push(query);
    const result = await query;

    expect(listNotificationsMock).toHaveBeenCalledWith("u1");
    expect("data" in result && result.data).toHaveLength(1);
  });

  it("marks single notification as read", async () => {
    markNotificationReadMock.mockResolvedValue({
      id: "n1",
      user_id: "u1",
      message: "Hello",
      created_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    });

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (gdm) => gdm().concat(baseApi.middleware),
    });
    stores.push(store);

    const mutation = store.dispatch(
      notificationsApi.endpoints.markNotificationRead.initiate({
        notificationId: "n1",
        userId: "u1",
      }),
    );
    const result = await mutation;

    expect(markNotificationReadMock).toHaveBeenCalledWith({
      notificationId: "n1",
      userId: "u1",
    });
    expect("data" in result && result.data?.id).toBe("n1");
  });
});

import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseApi } from "@/store/redux/api/base-api";
import { customerApi } from "@/store/redux/api/customer-api";

const { listCustomerRequirementsMock } = vi.hoisted(() => ({
  listCustomerRequirementsMock: vi.fn(),
}));

const {
  listCustomerRequestsMock,
  getCustomerRequestByIdMock,
  createCustomerRequestMock,
  listRequestMessagesMock,
  sendRequestMessageMock,
} = vi.hoisted(() => ({
  listCustomerRequestsMock: vi.fn(),
  getCustomerRequestByIdMock: vi.fn(),
  createCustomerRequestMock: vi.fn(),
  listRequestMessagesMock: vi.fn(),
  sendRequestMessageMock: vi.fn(),
}));

vi.mock("@/services/requirements.service", () => ({
  listCustomerRequirements: listCustomerRequirementsMock,
}));

vi.mock("@/services/requests.service", () => ({
  listCustomerRequests: listCustomerRequestsMock,
  getCustomerRequestById: getCustomerRequestByIdMock,
  createCustomerRequest: createCustomerRequestMock,
}));

vi.mock("@/services/messages.service", () => ({
  listRequestMessages: listRequestMessagesMock,
  sendRequestMessage: sendRequestMessageMock,
}));

describe("customerApi", () => {
  const stores: Array<ReturnType<typeof configureStore>> = [];
  const subscriptions: Array<{ unsubscribe?: () => void }> = [];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    subscriptions.splice(0).forEach((sub) => sub.unsubscribe?.());
    stores.splice(0).forEach((store) => {
      store.dispatch(baseApi.util.resetApiState());
    });
    vi.clearAllMocks();
  });

  it("loads customer orders from API", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          orders: [
            {
              id: "order-1",
              status: "Purchase Order Received",
              poReference: "PO-1001",
              updatedAt: "2026-06-21T10:00:00.000Z",
              timeline: [],
            },
          ],
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
      customerApi.endpoints.getCustomerOrders.initiate("org-1"),
    );
    subscriptions.push(query);
    const result = await query;

    expect(fetchMock).toHaveBeenCalled();
    expect("data" in result && result.data).toEqual([
      {
        id: "order-1",
        status: "Purchase Order Received",
        poReference: "PO-1001",
        updatedAt: "2026-06-21T10:00:00.000Z",
        timeline: [],
      },
    ]);
  });

  it("loads customer requirements using requirements service", async () => {
    listCustomerRequirementsMock.mockResolvedValue([
      {
        id: "req-1",
        packageStream: "sales_ops",
        providerName: "Provider X",
        title: "Upload purchase order",
        description: null,
        whyRequired: null,
        evidenceType: "purchase_order",
        isRequired: true,
        status: "missing",
        statusReason: null,
        dueAt: null,
        updatedAt: "2026-06-21T10:00:00.000Z",
      },
    ]);

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (gdm) => gdm().concat(baseApi.middleware),
    });
    stores.push(store);

    const query = store.dispatch(
      customerApi.endpoints.getCustomerRequirements.initiate("org-1"),
    );
    subscriptions.push(query);
    const result = await query;

    expect(listCustomerRequirementsMock).toHaveBeenCalledWith("org-1");
    expect("data" in result && result.data).toHaveLength(1);
  });

  it("updates billing and returns success", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (gdm) => gdm().concat(baseApi.middleware),
    });
    stores.push(store);

    const mutation = store.dispatch(
      customerApi.endpoints.updateCustomerBilling.initiate({
        action: "upgrade",
        packageCode: "silver",
        organizationId: "org-1",
      }),
    );
    const result = await mutation;

    expect(fetchMock).toHaveBeenCalled();
    expect("data" in result && result.data).toEqual({ ok: true });
  });
});

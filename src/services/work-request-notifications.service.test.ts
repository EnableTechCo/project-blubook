import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";

const insertNotifications = vi.fn().mockResolvedValue(undefined);
const resolveCustomerUserIds = vi.fn().mockResolvedValue(["cust-1"]);
const resolvePartnerUserIds = vi.fn().mockResolvedValue(["prov-1"]);

vi.mock("@/lib/workflow/order-lifecycle", () => ({
  insertNotifications: (...a: unknown[]) => insertNotifications(...a),
  resolveCustomerUserIds: (...a: unknown[]) => resolveCustomerUserIds(...a),
  resolvePartnerUserIds: (...a: unknown[]) => resolvePartnerUserIds(...a),
}));

import { notifyCustomer, notifyProvider } from "./work-request-notifications.service";

type Res = { data?: unknown; error?: { message: string } | null };

function makeAdmin(result: Res) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => result,
    then: (resolve: (v: Res) => unknown) => resolve(result),
  };
  return { from: () => q } as unknown as AppSupabaseClient;
}

const REQUEST = {
  data: { id: "wr1", organization_id: "org1" },
  error: null,
};

/** The notification rows handed to insertNotifications on the last call. */
const lastRows = () =>
  insertNotifications.mock.calls.at(-1)?.[1] as Array<{
    userId: string;
    organizationId: string | null;
    message: string;
    metadata: Record<string, unknown>;
  }>;

beforeEach(() => {
  insertNotifications.mockClear();
  resolveCustomerUserIds.mockClear();
  resolvePartnerUserIds.mockClear();
  resolveCustomerUserIds.mockResolvedValue(["cust-1"]);
  resolvePartnerUserIds.mockResolvedValue(["prov-1"]);
});

describe("notifyCustomer", () => {
  it("delivers a serialized message to the request's customers", async () => {
    await notifyCustomer(makeAdmin(REQUEST), {
      workRequestId: "wr1",
      event: "work_order_started",
      label: "Invoicing",
      serviceName: "Sales Ops",
    });

    const rows = lastRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("cust-1");
    expect(rows[0].organizationId).toBe("org1");
    expect(rows[0].message).toContain("your Sales Ops provider");
    expect(rows[0].metadata).toMatchObject({
      source: "work_request_lifecycle",
      event: "work_order_started",
      audience: "customer",
      work_request_id: "wr1",
    });
  });

  it("says nothing when the request has no organization", async () => {
    await notifyCustomer(makeAdmin({ data: { id: "wr1", organization_id: null }, error: null }), {
      workRequestId: "wr1",
      event: "work_request_completed",
    });
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("says nothing when the organization has no users", async () => {
    resolveCustomerUserIds.mockResolvedValue([]);
    await notifyCustomer(makeAdmin(REQUEST), {
      workRequestId: "wr1",
      event: "work_request_completed",
    });
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("never throws into the caller — work must not roll back over a message", async () => {
    insertNotifications.mockRejectedValueOnce(new Error("db down"));
    await expect(
      notifyCustomer(makeAdmin(REQUEST), {
        workRequestId: "wr1",
        event: "work_order_completed",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("notifyProvider", () => {
  it("delivers an anonymous message to the provider's users", async () => {
    await notifyProvider(makeAdmin({ data: null, error: null }), {
      providerId: "p1",
      workRequestItemId: "aa11bb22-2222-4222-8222-222222222222",
      label: "Invoicing",
      serviceName: "Sales Ops",
    });

    const rows = lastRows();
    expect(rows[0].userId).toBe("prov-1");
    expect(rows[0].message).toContain("Invoicing");
    expect(rows[0].message).toContain("WO-AA11BB22");
  });

  it("ties the provider's notification to no organization", async () => {
    // A customer org id here would leak who the work is for.
    await notifyProvider(makeAdmin({ data: null, error: null }), {
      providerId: "p1",
      workRequestItemId: "i1",
      label: "Invoicing",
      serviceName: "Sales Ops",
    });

    expect(lastRows()[0].organizationId).toBeNull();
    expect(lastRows()[0].metadata).not.toHaveProperty("work_request_id");
    expect(lastRows()[0].metadata).not.toHaveProperty("organization_id");
  });

  it("says nothing when the provider has no reachable users", async () => {
    resolvePartnerUserIds.mockResolvedValue([]);
    await notifyProvider(makeAdmin({ data: null, error: null }), {
      providerId: "p1",
      workRequestItemId: "i1",
      label: "Invoicing",
      serviceName: "Sales Ops",
    });
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("never throws into the caller", async () => {
    insertNotifications.mockRejectedValueOnce(new Error("db down"));
    await expect(
      notifyProvider(makeAdmin({ data: null, error: null }), {
        providerId: "p1",
        workRequestItemId: "i1",
        label: "Invoicing",
        serviceName: "Sales Ops",
      }),
    ).resolves.toBeUndefined();
  });
});

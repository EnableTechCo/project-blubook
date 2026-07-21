import { describe, expect, it } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import {
  acceptWorkOrderItem,
  listProviderWorkOrders,
} from "./provider-work-orders.service";

type Res = { data?: unknown; error?: { message: string } | null };

function makeAdmin(selects: Record<string, Res[]>) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const filters: Array<{ table: string; args: unknown[] }> = [];

  const from = (table: string) => {
    let mode: "select" | "update" = "select";
    let pending: Res = { data: [], error: null };

    const q: Record<string, unknown> = {
      select: () => {
        if (mode === "select") {
          pending = selects[table]?.shift() ?? { data: [], error: null };
        }
        return q;
      },
      update: (payload: Record<string, unknown>) => {
        mode = "update";
        updates.push({ table, payload });
        pending = { data: null, error: null };
        return q;
      },
      eq: (...args: unknown[]) => {
        filters.push({ table, args });
        return q;
      },
      in: (...args: unknown[]) => {
        filters.push({ table, args });
        return q;
      },
      order: () => q,
      maybeSingle: async () => pending,
      single: async () => pending,
      then: (resolve: (v: Res) => unknown) => resolve(pending),
    };
    return q;
  };

  return { admin: { from } as unknown as AppSupabaseClient, updates, filters };
}

const ITEM_ID = "3f6b2c9a-1111-4111-8111-111111111111";

const itemRow = (overrides: Record<string, unknown> = {}) => ({
  id: ITEM_ID,
  catalog_item_id: "ci1",
  service_id: "s1",
  status: "assigned",
  released_at: "2026-07-21T00:00:00Z",
  completed_at: null,
  ...overrides,
});

describe("listProviderWorkOrders", () => {
  it("returns the provider's work orders with service and label", async () => {
    const { admin } = makeAdmin({
      work_request_items: [{ data: [itemRow()], error: null }],
      catalog_items: [
        {
          data: [{ id: "ci1", label: "Invoicing", description: "Raise invoices" }],
          error: null,
        },
      ],
      services: [{ data: [{ id: "s1", name: "Sales Ops" }], error: null }],
    });

    const res = await listProviderWorkOrders(admin, { providerId: "p1" });

    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id: ITEM_ID,
      label: "Invoicing",
      description: "Raise invoices",
      serviceName: "Sales Ops",
      status: "assigned",
    });
  });

  it("never exposes the customer or the parent request", async () => {
    // Anonymity is the point of this surface: knowing the parent request id
    // would let a provider group items and infer one customer behind them.
    const { admin } = makeAdmin({
      work_request_items: [{ data: [itemRow()], error: null }],
      catalog_items: [
        { data: [{ id: "ci1", label: "Invoicing", description: null }], error: null },
      ],
      services: [{ data: [{ id: "s1", name: "Sales Ops" }], error: null }],
    });

    const [order] = await listProviderWorkOrders(admin, { providerId: "p1" });
    const keys = Object.keys(order);

    expect(keys).not.toContain("work_request_id");
    expect(keys).not.toContain("workRequestId");
    expect(keys).not.toContain("organizationId");
    expect(keys).not.toContain("customerId");
    expect(JSON.stringify(order)).not.toContain("org");
  });

  it("exposes an opaque reference rather than a raw id", async () => {
    const { admin } = makeAdmin({
      work_request_items: [{ data: [itemRow()], error: null }],
      catalog_items: [
        { data: [{ id: "ci1", label: "Invoicing", description: null }], error: null },
      ],
      services: [{ data: [{ id: "s1", name: "Sales Ops" }], error: null }],
    });

    const [order] = await listProviderWorkOrders(admin, { providerId: "p1" });
    expect(order.reference).toBe("3F6B2C9A");
    expect(order.reference.length).toBe(8);
  });

  it("returns nothing when the provider has no work", async () => {
    const { admin } = makeAdmin({
      work_request_items: [{ data: [], error: null }],
    });
    expect(await listProviderWorkOrders(admin, { providerId: "p1" })).toEqual([]);
  });

  it("excludes completed work unless asked for it", async () => {
    const { admin, filters } = makeAdmin({
      work_request_items: [{ data: [], error: null }],
    });
    await listProviderWorkOrders(admin, { providerId: "p1" });

    const statusFilter = filters.find(
      (f) => f.table === "work_request_items" && Array.isArray(f.args[1]),
    );
    expect(statusFilter?.args[1]).toEqual(["assigned", "in_progress"]);
  });
});

describe("acceptWorkOrderItem", () => {
  it("moves an assigned item into progress", async () => {
    const { admin, updates } = makeAdmin({
      work_request_items: [
        { data: { id: ITEM_ID, status: "assigned", assigned_provider_id: "p1" }, error: null },
      ],
    });

    const res = await acceptWorkOrderItem(admin, {
      workRequestItemId: ITEM_ID,
      expectedProviderId: "p1",
    });

    expect(res.ok).toBe(true);
    expect(updates[0].payload).toEqual({ status: "in_progress" });
  });

  it("refuses to accept another provider's work order", async () => {
    const { admin, updates } = makeAdmin({
      work_request_items: [
        { data: { id: ITEM_ID, status: "assigned", assigned_provider_id: "other" }, error: null },
      ],
    });

    const res = await acceptWorkOrderItem(admin, {
      workRequestItemId: ITEM_ID,
      expectedProviderId: "p1",
    });

    expect(res).toMatchObject({ ok: false, status: 403 });
    expect(updates).toHaveLength(0);
  });

  it("rejects accepting the same work order twice", async () => {
    const { admin } = makeAdmin({
      work_request_items: [
        { data: { id: ITEM_ID, status: "in_progress", assigned_provider_id: "p1" }, error: null },
      ],
    });

    const res = await acceptWorkOrderItem(admin, {
      workRequestItemId: ITEM_ID,
      expectedProviderId: "p1",
    });

    expect(res).toMatchObject({ ok: false, status: 409 });
    expect(res.error).toMatch(/already accepted/);
  });

  it("404s an unknown work order", async () => {
    const { admin } = makeAdmin({
      work_request_items: [{ data: null, error: null }],
    });

    const res = await acceptWorkOrderItem(admin, {
      workRequestItemId: "nope",
      expectedProviderId: "p1",
    });

    expect(res).toMatchObject({ ok: false, status: 404 });
  });
});

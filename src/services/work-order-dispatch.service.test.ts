import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";

const queueWorkflowEvent = vi.fn().mockResolvedValue("event-1");
vi.mock("@/lib/workflow/engine", () => ({
  queueWorkflowEvent: (...args: unknown[]) => queueWorkflowEvent(...args),
}));

import { dispatchReadyItems } from "./work-order-dispatch.service";

type Res = { data?: unknown; error?: { message: string } | null };

/**
 * Fake Supabase client. `selects` holds a per-table queue of responses consumed
 * in call order; inserts and updates are recorded for assertions.
 */
function makeAdmin(selects: Record<string, Res[]>) {
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const from = (table: string) => {
    let mode: "select" | "insert" | "update" = "select";
    let pending: Res = { data: [], error: null };

    const q: Record<string, unknown> = {
      select: () => {
        if (mode === "select") {
          pending = selects[table]?.shift() ?? { data: [], error: null };
        }
        return q;
      },
      insert: (payload: Record<string, unknown>) => {
        mode = "insert";
        inserts.push({ table, payload });
        pending = { data: { id: `${table}-row` }, error: null };
        return q;
      },
      update: (payload: Record<string, unknown>) => {
        mode = "update";
        updates.push({ table, payload });
        pending = { data: null, error: null };
        return q;
      },
      eq: () => q,
      in: () => q,
      is: () => q,
      not: () => q,
      order: () => q,
      limit: () => q,
      single: async () => pending,
      maybeSingle: async () => pending,
      then: (resolve: (v: Res) => unknown) => resolve(pending),
    };
    return q;
  };

  return { admin: { from } as unknown as AppSupabaseClient, inserts, updates };
}

const PARENT = {
  data: { id: "wr1", organization_id: "org1", package_id: "pkg1" },
  error: null,
};
const SERVICE = {
  data: [{ id: "s1", key: "Sales Ops", name: "Sales Ops" }],
  error: null,
};
const LABEL = { data: [{ id: "ci1", label: "Invoicing" }], error: null };

const readyItem = (id: string, catalogItemId = "ci1") => ({
  id,
  service_id: "s1",
  catalog_item_id: catalogItemId,
});

const partner = (id: string, isActive = true) => ({
  id,
  name: `Partner ${id}`,
  package_stream: "Sales Ops",
  is_active: isActive,
});

/** Build the select queues for one dispatch run. */
function queues(opts: {
  ready: Array<ReturnType<typeof readyItem>>;
  partners: Array<ReturnType<typeof partner>>;
  openLoad?: Array<{ assigned_provider_id: string }>;
  completed?: Array<{ assigned_provider_id: string }>;
  failed?: Array<{ provider_id: string }>;
  labels?: Res;
}): Record<string, Res[]> {
  return {
    work_requests: [PARENT],
    work_request_items: [
      { data: opts.ready, error: null },
      { data: opts.openLoad ?? [], error: null },
      { data: opts.completed ?? [], error: null },
    ],
    services: [SERVICE],
    catalog_items: [opts.labels ?? LABEL],
    service_partners: [{ data: opts.partners, error: null }],
    customer_provider_requests: [{ data: opts.failed ?? [], error: null }],
  };
}

beforeEach(() => {
  queueWorkflowEvent.mockClear();
});

describe("dispatchReadyItems", () => {
  it("does nothing when the request has no ready items", async () => {
    const { admin, updates } = makeAdmin({
      work_requests: [PARENT],
      work_request_items: [{ data: [], error: null }],
    });

    const res = await dispatchReadyItems(admin, { workRequestId: "wr1" });

    expect(res).toEqual({ dispatched: [], unplaced: [] });
    expect(updates).toHaveLength(0);
    expect(queueWorkflowEvent).not.toHaveBeenCalled();
  });

  it("assigns the least-loaded provider and records the engagement", async () => {
    const { admin, inserts, updates } = makeAdmin(
      queues({
        ready: [readyItem("i1")],
        partners: [partner("busy"), partner("light")],
        openLoad: [
          { assigned_provider_id: "busy" },
          { assigned_provider_id: "busy" },
        ],
      }),
    );

    const res = await dispatchReadyItems(admin, { workRequestId: "wr1" });

    expect(res.unplaced).toEqual([]);
    expect(res.dispatched).toHaveLength(1);
    expect(res.dispatched[0]).toMatchObject({
      itemId: "i1",
      label: "Invoicing",
      serviceName: "Sales Ops",
      providerId: "light",
    });

    // Item flipped to assigned with the provider and a release timestamp.
    expect(updates[0].table).toBe("work_request_items");
    expect(updates[0].payload).toMatchObject({
      assigned_provider_id: "light",
      status: "assigned",
    });
    expect(updates[0].payload.released_at).toBeTruthy();

    // Engagement row written to the layer the #44-47 provider flow reads.
    const engagement = inserts.find(
      (i) => i.table === "customer_provider_requests",
    );
    expect(engagement?.payload).toMatchObject({
      organization_id: "org1",
      package_stream: "Sales Ops",
      provider_id: "light",
      request_status: "sent",
    });

    expect(queueWorkflowEvent).toHaveBeenCalledWith(
      "work_request.item_dispatched",
      expect.objectContaining({ workRequestItemId: "i1", providerId: "light" }),
    );
  });

  it("spreads a batch across providers instead of piling onto one", async () => {
    const { admin, updates } = makeAdmin(
      queues({
        ready: [readyItem("i1"), readyItem("i2")],
        partners: [partner("a"), partner("b")],
      }),
    );

    const res = await dispatchReadyItems(admin, { workRequestId: "wr1" });

    expect(res.dispatched).toHaveLength(2);
    const assigned = updates.map((u) => u.payload.assigned_provider_id);
    expect(new Set(assigned).size).toBe(2);
  });

  it("leaves an item ready and reports it when no provider is registered", async () => {
    const { admin, updates } = makeAdmin(
      queues({ ready: [readyItem("i1")], partners: [] }),
    );

    const res = await dispatchReadyItems(admin, { workRequestId: "wr1" });

    expect(res.dispatched).toEqual([]);
    expect(res.unplaced).toHaveLength(1);
    expect(res.unplaced[0]).toMatchObject({ itemId: "i1", saturated: false });
    expect(res.unplaced[0].reason).toMatch(/No provider is registered/);
    expect(updates).toHaveLength(0); // still ready — nothing was assigned
  });

  it("flags saturation when every provider is at capacity", async () => {
    // One partner already holding the default max of 10 open work orders.
    const { admin } = makeAdmin(
      queues({
        ready: [readyItem("i1")],
        partners: [partner("a")],
        openLoad: Array.from({ length: 10 }, () => ({
          assigned_provider_id: "a",
        })),
      }),
    );

    const res = await dispatchReadyItems(admin, { workRequestId: "wr1" });

    expect(res.dispatched).toEqual([]);
    expect(res.unplaced[0].saturated).toBe(true);
    expect(res.unplaced[0].reason).toMatch(/at capacity/);
  });

  it("refuses to dispatch a request that has no organization", async () => {
    // The engagement layer is keyed by organization, so this cannot proceed.
    const { admin } = makeAdmin({
      work_requests: [
        {
          data: { id: "wr1", organization_id: null, package_id: "pkg1" },
          error: null,
        },
      ],
    });

    await expect(
      dispatchReadyItems(admin, { workRequestId: "wr1" }),
    ).rejects.toThrow(/no organization/);
  });

  it("still assigns when the dispatch event fails to queue", async () => {
    queueWorkflowEvent.mockRejectedValueOnce(new Error("queue down"));
    const { admin, updates } = makeAdmin(
      queues({ ready: [readyItem("i1")], partners: [partner("a")] }),
    );

    const res = await dispatchReadyItems(admin, { workRequestId: "wr1" });

    // The assignment is the source of truth; the event is a side-effect.
    expect(res.dispatched).toHaveLength(1);
    expect(updates[0].payload.status).toBe("assigned");
  });
});

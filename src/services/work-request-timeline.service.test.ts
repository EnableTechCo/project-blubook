import { describe, expect, it } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { getWorkRequestTimeline } from "./work-request-timeline.service";

type Res = { data?: unknown; error?: { message: string } | null };

function makeAdmin(selects: Record<string, Res[]>) {
  const selected: Array<{ table: string; columns: string }> = [];

  const from = (table: string) => {
    let pending: Res = { data: [], error: null };
    const q: Record<string, unknown> = {
      select: (columns?: string) => {
        selected.push({ table, columns: columns ?? "" });
        pending = selects[table]?.shift() ?? { data: [], error: null };
        return q;
      },
      eq: () => q,
      in: () => q,
      maybeSingle: async () => pending,
      single: async () => pending,
      then: (resolve: (v: Res) => unknown) => resolve(pending),
    };
    return q;
  };

  return { admin: { from } as unknown as AppSupabaseClient, selected };
}

const T0 = "2026-07-21T10:00:00.000Z";
const T1 = "2026-07-21T11:00:00.000Z";
const T2 = "2026-07-21T12:00:00.000Z";

const REQUEST = (overrides: Record<string, unknown> = {}): Res => ({
  data: {
    id: "3f6b2c9a-1111-4111-8111-111111111111",
    customer_id: "cust-1",
    status: "active",
    created_at: T0,
    updated_at: T2,
    ...overrides,
  },
  error: null,
});

const item = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  catalog_item_id: "ci1",
  service_id: "s1",
  status: "blocked",
  auto_included: false,
  created_at: T0,
  released_at: null,
  completed_at: null,
  ...overrides,
});

function scenario(opts: {
  request?: Res;
  items: ReturnType<typeof item>[];
  deps?: Array<{ work_request_item_id: string; depends_on_item_id: string }>;
}) {
  return {
    work_requests: [opts.request ?? REQUEST()],
    work_request_items: [{ data: opts.items, error: null }],
    catalog_items: [
      {
        data: [
          { id: "ci1", label: "Invoicing" },
          { id: "ci2", label: "Order processing" },
        ],
        error: null,
      },
    ],
    services: [{ data: [{ id: "s1", name: "Sales Ops" }], error: null }],
    work_request_item_dependencies: [{ data: opts.deps ?? [], error: null }],
  };
}

describe("getWorkRequestTimeline", () => {
  it("returns another customer's request as not found", async () => {
    // Not 403 — revealing that it exists would itself be a leak.
    const { admin } = makeAdmin(scenario({ items: [] }));
    const res = await getWorkRequestTimeline(admin, {
      workRequestId: "wr1",
      customerId: "someone-else",
    });
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("404s a request that does not exist", async () => {
    const { admin } = makeAdmin({ work_requests: [{ data: null, error: null }] });
    const res = await getWorkRequestTimeline(admin, {
      workRequestId: "nope",
      customerId: "cust-1",
    });
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("never asks the database for the assigned provider", async () => {
    // Anonymity by omission: if it is never selected, it cannot be returned.
    const { admin, selected } = makeAdmin(scenario({ items: [item()] }));
    await getWorkRequestTimeline(admin, {
      workRequestId: "wr1",
      customerId: "cust-1",
    });

    const itemSelect = selected.find((s) => s.table === "work_request_items");
    expect(itemSelect?.columns).not.toContain("assigned_provider_id");
  });

  it("summarises the request with an opaque reference", async () => {
    const { admin } = makeAdmin(
      scenario({
        items: [
          item({ id: "i1", status: "completed", completed_at: T2 }),
          item({ id: "i2", catalog_item_id: "ci2", status: "in_progress" }),
        ],
      }),
    );

    const res = await getWorkRequestTimeline(admin, {
      workRequestId: "wr1",
      customerId: "cust-1",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.timeline.reference).toBe("REQ-3F6B2C9A");
    expect(res.timeline.itemCount).toBe(2);
    expect(res.timeline.completedCount).toBe(1);
  });

  it("attributes started work to a service, never a provider", async () => {
    const { admin } = makeAdmin(
      scenario({ items: [item({ status: "in_progress", released_at: T1 })] }),
    );

    const res = await getWorkRequestTimeline(admin, {
      workRequestId: "wr1",
      customerId: "cust-1",
    });
    if (!res.ok) return;

    const started = res.timeline.entries.find((e) => e.kind === "started");
    expect(started?.message).toContain("your Sales Ops provider");
  });

  it("explains what a queued item is waiting for", async () => {
    const { admin } = makeAdmin(
      scenario({
        items: [item({ id: "i1" }), item({ id: "i2", catalog_item_id: "ci2" })],
        deps: [{ work_request_item_id: "i1", depends_on_item_id: "i2" }],
      }),
    );

    const res = await getWorkRequestTimeline(admin, {
      workRequestId: "wr1",
      customerId: "cust-1",
    });
    if (!res.ok) return;

    const queued = res.timeline.entries.find((e) => e.kind === "queued");
    expect(queued?.message).toContain("Order processing");
    expect(res.timeline.items[0].blockedByLabel).toBe("Order processing");
  });

  it("orders entries chronologically", async () => {
    const { admin } = makeAdmin(
      scenario({
        request: REQUEST({ status: "completed" }),
        items: [
          item({ status: "completed", released_at: T1, completed_at: T2 }),
        ],
      }),
    );

    const res = await getWorkRequestTimeline(admin, {
      workRequestId: "wr1",
      customerId: "cust-1",
    });
    if (!res.ok) return;

    const times = res.timeline.entries.map((e) => e.at);
    expect([...times].sort()).toEqual(times);
    expect(res.timeline.entries.at(0)?.kind).toBe("requested");
    expect(res.timeline.entries.at(-1)?.kind).toBe("request_completed");
  });

  it("discloses auto-added steps once, as a summary", async () => {
    const { admin } = makeAdmin(
      scenario({
        items: [
          item({ id: "i1", auto_included: true }),
          item({ id: "i2", catalog_item_id: "ci2", auto_included: true }),
        ],
      }),
    );

    const res = await getWorkRequestTimeline(admin, {
      workRequestId: "wr1",
      customerId: "cust-1",
    });
    if (!res.ok) return;

    const added = res.timeline.entries.filter((e) => e.kind === "auto_added");
    expect(added).toHaveLength(1);
    expect(added[0].message).toContain("2 required steps");
  });
});

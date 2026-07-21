import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";

const queueWorkflowEvent = vi.fn().mockResolvedValue("event-1");
vi.mock("@/lib/workflow/engine", () => ({
  queueWorkflowEvent: (...args: unknown[]) => queueWorkflowEvent(...args),
}));

const dispatchReadyItems = vi
  .fn()
  .mockResolvedValue({ dispatched: [], unplaced: [] });
vi.mock("@/services/work-order-dispatch.service", () => ({
  dispatchReadyItems: (...args: unknown[]) => dispatchReadyItems(...args),
}));

import {
  advanceWorkRequest,
  completeWorkOrderItem,
} from "./work-order-completion.service";

type Res = { data?: unknown; error?: { message: string } | null };

function makeAdmin(selects: Record<string, Res[]>) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

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
      eq: () => q,
      neq: () => q,
      in: () => q,
      maybeSingle: async () => pending,
      single: async () => pending,
      then: (resolve: (v: Res) => unknown) => resolve(pending),
    };
    return q;
  };

  return { admin: { from } as unknown as AppSupabaseClient, updates };
}

const items = (rows: Array<{ id: string; status: string }>): Res => ({
  data: rows,
  error: null,
});
const deps = (
  rows: Array<{ work_request_item_id: string; depends_on_item_id: string }>,
): Res => ({ data: rows, error: null });

beforeEach(() => {
  queueWorkflowEvent.mockClear();
  dispatchReadyItems.mockClear();
  dispatchReadyItems.mockResolvedValue({ dispatched: [], unplaced: [] });
});

describe("advanceWorkRequest", () => {
  it("releases an item once its prerequisite completes, then dispatches", async () => {
    dispatchReadyItems.mockResolvedValue({
      dispatched: [{ itemId: "A" }],
      unplaced: [],
    });

    const { admin, updates } = makeAdmin({
      work_request_items: [
        items([
          { id: "A", status: "blocked" },
          { id: "B", status: "completed" },
        ]),
      ],
      work_request_item_dependencies: [
        deps([{ work_request_item_id: "A", depends_on_item_id: "B" }]),
      ],
    });

    const res = await advanceWorkRequest(admin, { workRequestId: "wr1" });

    expect(res.releasedItemIds).toEqual(["A"]);
    expect(updates[0]).toMatchObject({
      table: "work_request_items",
      payload: { status: "ready" },
    });
    expect(dispatchReadyItems).toHaveBeenCalledOnce();
    expect(res.dispatchedCount).toBe(1);
    expect(res.requestCompleted).toBe(false);
  });

  it("releases nothing while a prerequisite is outstanding", async () => {
    const { admin, updates } = makeAdmin({
      work_request_items: [
        items([
          { id: "A", status: "blocked" },
          { id: "B", status: "in_progress" },
        ]),
      ],
      work_request_item_dependencies: [
        deps([{ work_request_item_id: "A", depends_on_item_id: "B" }]),
      ],
    });

    const res = await advanceWorkRequest(admin, { workRequestId: "wr1" });

    expect(res.releasedItemIds).toEqual([]);
    // No status update issued — only dispatch ran.
    expect(updates).toHaveLength(0);
    expect(res.requestCompleted).toBe(false);
  });

  it("closes the parent and emits a completion event when all items are done", async () => {
    const { admin, updates } = makeAdmin({
      work_request_items: [
        items([
          { id: "A", status: "completed" },
          { id: "B", status: "completed" },
        ]),
      ],
      work_request_item_dependencies: [deps([])],
    });

    const res = await advanceWorkRequest(admin, { workRequestId: "wr1" });

    expect(res.requestCompleted).toBe(true);
    expect(updates).toContainEqual({
      table: "work_requests",
      payload: { status: "completed" },
    });
    expect(queueWorkflowEvent).toHaveBeenCalledWith(
      "work_request.completed",
      expect.objectContaining({ workRequestId: "wr1" }),
    );
  });

  it("does not close a request that still has open work", async () => {
    const { admin } = makeAdmin({
      work_request_items: [
        items([
          { id: "A", status: "completed" },
          { id: "B", status: "assigned" },
        ]),
      ],
      work_request_item_dependencies: [deps([])],
    });

    const res = await advanceWorkRequest(admin, { workRequestId: "wr1" });

    expect(res.requestCompleted).toBe(false);
    expect(queueWorkflowEvent).not.toHaveBeenCalled();
  });
});

describe("completeWorkOrderItem", () => {
  const assignedItem = (overrides: Record<string, unknown> = {}): Res => ({
    data: {
      id: "i1",
      work_request_id: "wr1",
      status: "in_progress",
      assigned_provider_id: "p1",
      ...overrides,
    },
    error: null,
  });

  it("completes an assigned item and advances the request", async () => {
    const { admin, updates } = makeAdmin({
      work_request_items: [
        assignedItem(),
        items([{ id: "i1", status: "completed" }]),
      ],
      work_request_item_dependencies: [deps([])],
    });

    const res = await completeWorkOrderItem(admin, {
      workRequestItemId: "i1",
      expectedProviderId: "p1",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.queuedForRetry).toBe(false);
    expect(updates[0].payload).toMatchObject({ status: "completed" });
    expect(updates[0].payload.completed_at).toBeTruthy();
    expect(res.advance?.requestCompleted).toBe(true);
  });

  it("refuses to complete another provider's work order", async () => {
    const { admin, updates } = makeAdmin({
      work_request_items: [assignedItem({ assigned_provider_id: "someone" })],
    });

    const res = await completeWorkOrderItem(admin, {
      workRequestItemId: "i1",
      expectedProviderId: "p1",
    });

    expect(res).toMatchObject({ ok: false, status: 403 });
    expect(updates).toHaveLength(0);
  });

  it("rejects completing an item that was never started", async () => {
    const { admin } = makeAdmin({
      work_request_items: [assignedItem({ status: "blocked" })],
    });

    const res = await completeWorkOrderItem(admin, {
      workRequestItemId: "i1",
      expectedProviderId: "p1",
    });

    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it("rejects double completion", async () => {
    const { admin } = makeAdmin({
      work_request_items: [assignedItem({ status: "completed" })],
    });

    const res = await completeWorkOrderItem(admin, {
      workRequestItemId: "i1",
      expectedProviderId: "p1",
    });

    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it("404s an unknown item", async () => {
    const { admin } = makeAdmin({
      work_request_items: [{ data: null, error: null }],
    });

    const res = await completeWorkOrderItem(admin, {
      workRequestItemId: "nope",
    });

    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("queues a retry when the inline advance fails", async () => {
    // The completion itself must stand even if advancing blows up.
    dispatchReadyItems.mockRejectedValueOnce(new Error("dispatch exploded"));

    const { admin } = makeAdmin({
      work_request_items: [
        assignedItem(),
        items([{ id: "i1", status: "completed" }]),
      ],
      work_request_item_dependencies: [deps([])],
    });

    const res = await completeWorkOrderItem(admin, {
      workRequestItemId: "i1",
      expectedProviderId: "p1",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.queuedForRetry).toBe(true);
    expect(res.advance).toBeNull();
    expect(queueWorkflowEvent).toHaveBeenCalledWith(
      "work_request.item_completed",
      expect.objectContaining({ workRequestId: "wr1" }),
    );
  });
});

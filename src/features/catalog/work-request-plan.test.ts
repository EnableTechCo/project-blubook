import { describe, expect, it } from "vitest";
import { planWorkRequestItems } from "./work-request-plan";
import type { DependencyEdge } from "./dependency-graph";

const edge = (a: string, b: string): DependencyEdge => ({
  catalogItemId: a,
  dependsOnItemId: b,
});

const svc = (...ids: string[]) =>
  new Map(ids.map((id) => [id, `svc-${id}`] as const));

const byStatus = (
  items: ReturnType<typeof planWorkRequestItems>["items"],
) => Object.fromEntries(items.map((i) => [i.catalogItemId, i.status]));

describe("planWorkRequestItems", () => {
  it("marks a lone item ready with its service", () => {
    const plan = planWorkRequestItems(
      { allIds: ["A"], autoIncludedIds: [] },
      [],
      svc("A"),
    );
    expect(plan.items).toEqual([
      { catalogItemId: "A", serviceId: "svc-A", autoIncluded: false, status: "ready" },
    ]);
    expect(plan.dependencies).toEqual([]);
  });

  it("blocks the dependent, readies the prerequisite (Buy Goods case)", () => {
    // Deliver(A) depends on BuyGoods(B); customer picked B, A auto-included.
    const plan = planWorkRequestItems(
      { allIds: ["A", "B"], autoIncludedIds: ["A"] },
      [edge("A", "B")],
      svc("A", "B"),
    );
    expect(byStatus(plan.items)).toEqual({ A: "blocked", B: "ready" });
    expect(plan.items.find((i) => i.catalogItemId === "A")?.autoIncluded).toBe(true);
    expect(plan.items.find((i) => i.catalogItemId === "B")?.autoIncluded).toBe(false);
    expect(plan.dependencies).toEqual([{ catalogItemId: "A", dependsOnItemId: "B" }]);
  });

  it("readies only the roots of a chain (A→B→C)", () => {
    const plan = planWorkRequestItems(
      { allIds: ["A", "B", "C"], autoIncludedIds: ["A", "C"] },
      [edge("A", "B"), edge("B", "C")],
      svc("A", "B", "C"),
    );
    // C has no prerequisite -> ready. A and B each depend on something -> blocked.
    expect(byStatus(plan.items)).toEqual({ A: "blocked", B: "blocked", C: "ready" });
  });

  it("ignores edges whose endpoints are outside the request", () => {
    const plan = planWorkRequestItems(
      { allIds: ["A"], autoIncludedIds: [] },
      [edge("A", "Z")], // Z not in the request
      svc("A"),
    );
    // The dangling edge is dropped, so A has no in-graph prerequisite -> ready.
    expect(plan.dependencies).toEqual([]);
    expect(byStatus(plan.items)).toEqual({ A: "ready" });
  });

  it("handles a diamond: the shared prerequisite is ready, the rest blocked", () => {
    // A→B, A→C, B→D, C→D  (A depends on B and C; B and C depend on D)
    const plan = planWorkRequestItems(
      { allIds: ["A", "B", "C", "D"], autoIncludedIds: ["B", "C", "D"] },
      [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")],
      svc("A", "B", "C", "D"),
    );
    expect(byStatus(plan.items)).toEqual({
      A: "blocked",
      B: "blocked",
      C: "blocked",
      D: "ready",
    });
    expect(plan.dependencies).toHaveLength(4);
  });
});

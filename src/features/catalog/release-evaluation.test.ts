import { describe, expect, it } from "vitest";
import {
  evaluateRelease,
  type ReleaseDependency,
  type ReleaseItem,
  type WorkRequestItemStatus,
} from "./release-evaluation";

const item = (id: string, status: WorkRequestItemStatus): ReleaseItem => ({
  id,
  status,
});
const dep = (a: string, b: string): ReleaseDependency => ({
  workRequestItemId: a,
  dependsOnItemId: b,
});

describe("evaluateRelease", () => {
  it("releases nothing while the prerequisite is outstanding", () => {
    // A depends on B; B is still in progress.
    const res = evaluateRelease(
      [item("A", "blocked"), item("B", "in_progress")],
      [dep("A", "B")],
    );
    expect(res.releasableIds).toEqual([]);
    expect(res.stillBlockedIds).toEqual(["A"]);
    expect(res.allComplete).toBe(false);
  });

  it("releases the dependent once its prerequisite completes", () => {
    const res = evaluateRelease(
      [item("A", "blocked"), item("B", "completed")],
      [dep("A", "B")],
    );
    expect(res.releasableIds).toEqual(["A"]);
    expect(res.stillBlockedIds).toEqual([]);
  });

  it("waits for ALL prerequisites, not just one", () => {
    // A depends on B and C; only B is done.
    const res = evaluateRelease(
      [item("A", "blocked"), item("B", "completed"), item("C", "ready")],
      [dep("A", "B"), dep("A", "C")],
    );
    expect(res.releasableIds).toEqual([]);
    expect(res.stillBlockedIds).toEqual(["A"]);
  });

  it("releases one layer at a time down a chain", () => {
    // A -> B -> C. C done: B releases, A stays blocked.
    const res = evaluateRelease(
      [item("A", "blocked"), item("B", "blocked"), item("C", "completed")],
      [dep("A", "B"), dep("B", "C")],
    );
    expect(res.releasableIds).toEqual(["B"]);
    expect(res.stillBlockedIds).toEqual(["A"]);
  });

  it("only considers blocked items — never re-releases active work", () => {
    const res = evaluateRelease(
      [
        item("A", "ready"),
        item("B", "assigned"),
        item("C", "in_progress"),
        item("D", "completed"),
      ],
      [],
    );
    expect(res.releasableIds).toEqual([]);
    expect(res.stillBlockedIds).toEqual([]);
  });

  it("ignores edges pointing outside the request", () => {
    // A's only prerequisite Z isn't part of this request, so A is releasable.
    const res = evaluateRelease([item("A", "blocked")], [dep("A", "Z")]);
    expect(res.releasableIds).toEqual(["A"]);
  });

  it("reports allComplete only when every item is complete", () => {
    expect(
      evaluateRelease(
        [item("A", "completed"), item("B", "completed")],
        [dep("A", "B")],
      ).allComplete,
    ).toBe(true);

    expect(
      evaluateRelease(
        [item("A", "in_progress"), item("B", "completed")],
        [dep("A", "B")],
      ).allComplete,
    ).toBe(false);
  });

  it("treats an empty request as not complete", () => {
    expect(evaluateRelease([], []).allComplete).toBe(false);
  });

  it("releases both arms of a diamond when the shared prerequisite completes", () => {
    // A->B, A->C, B->D, C->D ; D completed.
    const res = evaluateRelease(
      [
        item("A", "blocked"),
        item("B", "blocked"),
        item("C", "blocked"),
        item("D", "completed"),
      ],
      [dep("A", "B"), dep("A", "C"), dep("B", "D"), dep("C", "D")],
    );
    expect(res.releasableIds.sort()).toEqual(["B", "C"]);
    expect(res.stillBlockedIds).toEqual(["A"]);
  });
});

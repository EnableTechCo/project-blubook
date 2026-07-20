import { describe, expect, it } from "vitest";
import {
  hasCycle,
  wouldCreateCycle,
  type DependencyEdge,
} from "./dependency-graph";

// Edge (a, b) means "a depends on b" — b must complete before a.
const edge = (catalogItemId: string, dependsOnItemId: string): DependencyEdge => ({
  catalogItemId,
  dependsOnItemId,
});

describe("wouldCreateCycle", () => {
  it("allows the first edge in an empty graph", () => {
    expect(wouldCreateCycle([], edge("A", "B"))).toBe(false);
  });

  it("rejects a self-dependency", () => {
    expect(wouldCreateCycle([], edge("A", "A"))).toBe(true);
  });

  it("rejects a direct back-edge (A→B then B→A)", () => {
    expect(wouldCreateCycle([edge("A", "B")], edge("B", "A"))).toBe(true);
  });

  it("rejects a transitive back-edge (A→B→C then C→A)", () => {
    const existing = [edge("A", "B"), edge("B", "C")];
    expect(wouldCreateCycle(existing, edge("C", "A"))).toBe(true);
  });

  it("allows a shortcut edge that does not close a loop (A→B→C then A→C)", () => {
    const existing = [edge("A", "B"), edge("B", "C")];
    expect(wouldCreateCycle(existing, edge("A", "C"))).toBe(false);
  });

  it("allows an unrelated new edge", () => {
    const existing = [edge("A", "B"), edge("C", "D")];
    expect(wouldCreateCycle(existing, edge("B", "D"))).toBe(false);
  });

  it("detects a cycle through a diamond (A→B, A→C, B→D, C→D then D→A)", () => {
    const existing = [
      edge("A", "B"),
      edge("A", "C"),
      edge("B", "D"),
      edge("C", "D"),
    ];
    expect(wouldCreateCycle(existing, edge("D", "A"))).toBe(true);
  });

  it("allows adding to a diamond when no loop is closed (…then D→E)", () => {
    const existing = [
      edge("A", "B"),
      edge("A", "C"),
      edge("B", "D"),
      edge("C", "D"),
    ];
    expect(wouldCreateCycle(existing, edge("D", "E"))).toBe(false);
  });
});

describe("hasCycle", () => {
  it("reports no cycle for an empty graph", () => {
    expect(hasCycle([])).toBe(false);
  });

  it("reports no cycle for a simple chain", () => {
    expect(hasCycle([edge("A", "B"), edge("B", "C")])).toBe(false);
  });

  it("reports a cycle for a direct back-edge", () => {
    expect(hasCycle([edge("A", "B"), edge("B", "A")])).toBe(true);
  });

  it("reports a cycle for a transitive loop", () => {
    expect(hasCycle([edge("A", "B"), edge("B", "C"), edge("C", "A")])).toBe(
      true,
    );
  });

  it("reports no cycle for a diamond (shared prerequisite, no loop)", () => {
    const diamond = [
      edge("A", "B"),
      edge("A", "C"),
      edge("B", "D"),
      edge("C", "D"),
    ];
    expect(hasCycle(diamond)).toBe(false);
  });

  it("does not overflow on a deep chain", () => {
    const deep: DependencyEdge[] = [];
    for (let i = 0; i < 5000; i++) {
      deep.push(edge(`n${i}`, `n${i + 1}`));
    }
    expect(hasCycle(deep)).toBe(false);
    // close the loop and it must be detected
    deep.push(edge("n5000", "n0"));
    expect(hasCycle(deep)).toBe(true);
  });
});

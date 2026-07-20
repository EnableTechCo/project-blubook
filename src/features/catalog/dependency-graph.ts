// Catalog dependency-graph validation (Phase 1, P1-4)
//
// The catalog dependency graph must stay acyclic — a work order can't
// (transitively) depend on itself, or the gated-release engine (Phase 3)
// would deadlock waiting for a prerequisite that waits for it. Postgres
// can't express acyclicity as a constraint, so it is enforced here and
// called from the dependency API (P1-6) before an edge is written.

export interface DependencyEdge {
  /** The dependent item. Semantics: catalogItemId depends on dependsOnItemId. */
  catalogItemId: string;
  /** The prerequisite that must complete first. */
  dependsOnItemId: string;
}

/** Adjacency map: item -> the items it directly depends on. */
function buildDependsOnMap(edges: DependencyEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.catalogItemId) ?? [];
    list.push(edge.dependsOnItemId);
    map.set(edge.catalogItemId, list);
  }
  return map;
}

/** True if `target` is reachable from `start` by following dependency edges. */
function canReach(
  dependsOn: Map<string, string[]>,
  start: string,
  target: string,
): boolean {
  const stack = [start];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === target) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of dependsOn.get(node) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

/**
 * Whether adding `newEdge` to `existingEdges` would introduce a cycle.
 *
 * A self-dependency is always a cycle. Otherwise, adding "from depends on to"
 * closes a loop exactly when `to` can already reach `from` through existing
 * dependency edges.
 */
export function wouldCreateCycle(
  existingEdges: DependencyEdge[],
  newEdge: DependencyEdge,
): boolean {
  const { catalogItemId: from, dependsOnItemId: to } = newEdge;
  if (from === to) return true;

  const dependsOn = buildDependsOnMap(existingEdges);
  return canReach(dependsOn, to, from);
}

/**
 * Whether a complete set of edges already contains a cycle. Useful for
 * validating a materialized instance graph (Phase 2) or as a defensive check.
 * Uses DFS with a recursion stack (colour marking).
 */
export function hasCycle(edges: DependencyEdge[]): boolean {
  const dependsOn = buildDependsOnMap(edges);
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.catalogItemId);
    nodes.add(edge.dependsOnItemId);
  }

  const UNVISITED = 0;
  const IN_STACK = 1;
  const DONE = 2;
  const state = new Map<string, number>();

  // Iterative DFS so a deep chain can't overflow the call stack.
  for (const root of nodes) {
    if ((state.get(root) ?? UNVISITED) !== UNVISITED) continue;

    const stack: Array<{ node: string; iterator: number }> = [
      { node: root, iterator: 0 },
    ];
    state.set(root, IN_STACK);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbours = dependsOn.get(frame.node) ?? [];

      if (frame.iterator < neighbours.length) {
        const next = neighbours[frame.iterator];
        frame.iterator += 1;
        const nextState = state.get(next) ?? UNVISITED;
        if (nextState === IN_STACK) return true; // back-edge => cycle
        if (nextState === UNVISITED) {
          state.set(next, IN_STACK);
          stack.push({ node: next, iterator: 0 });
        }
      } else {
        state.set(frame.node, DONE);
        stack.pop();
      }
    }
  }

  return false;
}

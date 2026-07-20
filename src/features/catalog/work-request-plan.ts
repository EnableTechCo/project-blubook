import type {
  DependencyClosure,
  DependencyEdge,
} from "@/features/catalog/dependency-graph";

// Work-request planning (Phase 2, P2-5)
//
// Turns an expanded selection (the connected chain from resolveDependencyClosure)
// into the concrete items and instance dependency edges to create. Expansion
// (which items) is undirected; ordering (ready vs. blocked) uses the DIRECTED
// edges: an item is ready only if it has no prerequisite in the graph.

export interface PlannedItem {
  catalogItemId: string;
  serviceId: string;
  autoIncluded: boolean;
  status: "ready" | "blocked";
}

export interface PlannedDependency {
  catalogItemId: string;
  dependsOnItemId: string;
}

export interface WorkRequestPlan {
  items: PlannedItem[];
  dependencies: PlannedDependency[];
}

/**
 * @param closure          the expanded selection (allIds + autoIncludedIds)
 * @param edges            all catalog dependency edges (directed: X depends on Y)
 * @param serviceIdByItem  service id for every catalog item in the closure
 */
export function planWorkRequestItems(
  closure: DependencyClosure,
  edges: DependencyEdge[],
  serviceIdByItem: Map<string, string>,
): WorkRequestPlan {
  const inGraph = new Set(closure.allIds);
  const autoIncluded = new Set(closure.autoIncludedIds);

  // Only edges whose both endpoints are in this request become instance deps.
  const dependencies: PlannedDependency[] = edges
    .filter(
      (e) => inGraph.has(e.catalogItemId) && inGraph.has(e.dependsOnItemId),
    )
    .map((e) => ({
      catalogItemId: e.catalogItemId,
      dependsOnItemId: e.dependsOnItemId,
    }));

  // An item with a prerequisite (it appears as the dependent side of an edge)
  // starts blocked; everything else starts ready.
  const hasPrerequisite = new Set(dependencies.map((d) => d.catalogItemId));

  const items: PlannedItem[] = closure.allIds.map((id) => ({
    catalogItemId: id,
    serviceId: serviceIdByItem.get(id) ?? "",
    autoIncluded: autoIncluded.has(id),
    status: hasPrerequisite.has(id) ? "blocked" : "ready",
  }));

  return { items, dependencies };
}

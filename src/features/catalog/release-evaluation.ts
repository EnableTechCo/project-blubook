// Gated-release evaluation (Phase 3, P3-2)
//
// The heart of the unblock loop. Given the current state of a work request's
// items and their materialized dependency edges, decides which blocked items
// have earned release (every prerequisite complete) and whether the whole
// request is finished.
//
// Pure and side-effect free: the dispatcher (P3-3) and the completion handler
// (P3-4) both call this and act on the result, so the release rule lives in
// exactly one place.

export type WorkRequestItemStatus =
  | "blocked"
  | "ready"
  | "assigned"
  | "in_progress"
  | "completed";

export interface ReleaseItem {
  /** work_request_items.id */
  id: string;
  status: WorkRequestItemStatus;
}

/** A materialized instance edge: `workRequestItemId` needs `dependsOnItemId` done. */
export interface ReleaseDependency {
  workRequestItemId: string;
  dependsOnItemId: string;
}

export interface ReleaseEvaluation {
  /** Blocked items whose prerequisites are all complete — release these now. */
  releasableIds: string[];
  /** Blocked items still waiting on at least one incomplete prerequisite. */
  stillBlockedIds: string[];
  /** Every item in the request is complete — the parent can be closed. */
  allComplete: boolean;
}

/**
 * Evaluate which items may be released.
 *
 * Only `blocked` items are candidates: an item already ready, assigned, or in
 * progress has been released, and completed work is done. An item is
 * releasable when every prerequisite it points at is `completed`. Edges whose
 * prerequisite isn't part of the request are ignored — the same rule the
 * planner (P2-5) used when it decided the initial ready set.
 */
export function evaluateRelease(
  items: ReleaseItem[],
  dependencies: ReleaseDependency[],
): ReleaseEvaluation {
  const statusById = new Map(items.map((i) => [i.id, i.status]));

  // Prerequisites per item, ignoring edges that point outside the request.
  const prerequisites = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!statusById.has(dep.workRequestItemId)) continue;
    if (!statusById.has(dep.dependsOnItemId)) continue;
    const list = prerequisites.get(dep.workRequestItemId) ?? [];
    list.push(dep.dependsOnItemId);
    prerequisites.set(dep.workRequestItemId, list);
  }

  const releasableIds: string[] = [];
  const stillBlockedIds: string[] = [];

  for (const item of items) {
    if (item.status !== "blocked") continue;
    const prereqs = prerequisites.get(item.id) ?? [];
    const satisfied = prereqs.every(
      (id) => statusById.get(id) === "completed",
    );
    if (satisfied) releasableIds.push(item.id);
    else stillBlockedIds.push(item.id);
  }

  return {
    releasableIds,
    stillBlockedIds,
    allComplete:
      items.length > 0 && items.every((i) => i.status === "completed"),
  };
}

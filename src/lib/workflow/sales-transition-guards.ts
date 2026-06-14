/**
 * @deprecated Use `assertValidTransition` from `@/lib/workflow/transition-validator` directly.
 * This module is kept for backward compatibility with any external callers.
 */
import {
  getAllowedTransitionStatuses,
  assertValidTransition,
} from "@/lib/workflow/transition-validator";
import type { WorkflowEventType } from "@/lib/workflow/types";

export { assertValidTransition };

// Backward-compatible named export consumed by tests and legacy callers.
export const SALES_TRANSITION_GUARDS = {
  "order.validated":
    getAllowedTransitionStatuses("order.validated") ??
    ([] as readonly string[]),
  "order.packaged":
    getAllowedTransitionStatuses("order.packaged") ??
    ([] as readonly string[]),
} as const;

export type GuardedSalesEventType = "order.validated" | "order.packaged";

export function getAllowedSalesStatuses(eventType: string) {
  return getAllowedTransitionStatuses(eventType as WorkflowEventType) as
    | readonly string[]
    | undefined;
}

export function isAllowedSalesTransition(input: {
  eventType: string;
  currentStatus: string;
}) {
  const allowed = getAllowedSalesStatuses(input.eventType);
  if (!allowed || allowed.length === 0) {
    return true;
  }

  return allowed.includes(input.currentStatus);
}

import type { JsonObject } from "@/lib/supabase/json";

// Work-request notification catalog (Phase 4, P4-1)
//
// The meaningful moments in a work request's life, enumerated in one place.
// Emission (P4-3) and the anonymity serializer (P4-2) both read this catalog,
// so "which moments exist" and "who is allowed to hear about them" are stated
// once rather than re-decided at each call site — the rest of the codebase
// currently spells notification `source` as ad-hoc string literals, which is
// what this replaces for the work-request domain.
//
// The audience split is the load-bearing part. Customer and provider never see
// each other, so every event declares who it is for, and the metadata each
// audience receives is shaped differently: a customer may be told which
// request an item belongs to, a provider may not — the parent id would let
// them group items and infer that one customer is behind them.

export type NotificationAudience = "customer" | "provider";

export type WorkRequestNotificationEvent =
  /** Expansion pulled in prerequisites the customer did not pick. */
  | "work_orders_auto_added"
  /** An item cannot start yet — it is waiting on another work order. */
  | "work_order_queued"
  /** Prerequisites cleared; this item has been released and work is starting. */
  | "work_order_started"
  /** A single work order finished. */
  | "work_order_completed"
  /** Every work order in the request finished. */
  | "work_request_completed"
  /** Provider-facing: work has been routed to you. */
  | "work_order_assigned";

export interface WorkRequestNotificationDefinition {
  event: WorkRequestNotificationEvent;
  audience: NotificationAudience;
  /** Why this moment is worth telling someone about. */
  description: string;
}

/** Single `metadata.source` for the whole domain, so it is queryable as a set. */
export const WORK_REQUEST_NOTIFICATION_SOURCE = "work_request_lifecycle";

export const WORK_REQUEST_NOTIFICATIONS: Record<
  WorkRequestNotificationEvent,
  WorkRequestNotificationDefinition
> = {
  work_orders_auto_added: {
    event: "work_orders_auto_added",
    audience: "customer",
    description:
      "Required prerequisites were added to the customer's selection on their behalf.",
  },
  work_order_queued: {
    event: "work_order_queued",
    audience: "customer",
    description:
      "A work order is waiting behind a prerequisite and has not started yet.",
  },
  work_order_started: {
    event: "work_order_started",
    audience: "customer",
    description:
      "A prerequisite cleared, so a queued work order has been released and started.",
  },
  work_order_completed: {
    event: "work_order_completed",
    audience: "customer",
    description: "One work order in the request finished.",
  },
  work_request_completed: {
    event: "work_request_completed",
    audience: "customer",
    description: "Every work order in the request finished.",
  },
  work_order_assigned: {
    event: "work_order_assigned",
    audience: "provider",
    description:
      "Work was routed to this provider. Carries no customer or request identity.",
  },
};

export const ALL_WORK_REQUEST_NOTIFICATION_EVENTS = Object.keys(
  WORK_REQUEST_NOTIFICATIONS,
) as WorkRequestNotificationEvent[];

export function audienceFor(
  event: WorkRequestNotificationEvent,
): NotificationAudience {
  return WORK_REQUEST_NOTIFICATIONS[event].audience;
}

export function eventsForAudience(
  audience: NotificationAudience,
): WorkRequestNotificationEvent[] {
  return ALL_WORK_REQUEST_NOTIFICATION_EVENTS.filter(
    (event) => audienceFor(event) === audience,
  );
}

// ─── Metadata ────────────────────────────────────────────────────────────────

/** What a customer-facing notification may record. */
export interface CustomerNotificationContext {
  workRequestId: string;
  workRequestItemId?: string;
  /** Count for the summary events (e.g. how many items were auto-added). */
  itemCount?: number;
}

/**
 * What a provider-facing notification may record.
 *
 * Deliberately has no work request, organization, or customer field — there is
 * no way to pass one, so a future call site cannot leak identity by accident.
 */
export interface ProviderNotificationContext {
  workRequestItemId: string;
}

export type NotificationContext =
  | { audience: "customer"; event: WorkRequestNotificationEvent; context: CustomerNotificationContext }
  | { audience: "provider"; event: WorkRequestNotificationEvent; context: ProviderNotificationContext };

/**
 * Build the `notifications.metadata` payload for one event.
 *
 * Audience-aware by construction: the customer shape may carry the parent
 * request, the provider shape cannot express it. Every row also carries a
 * common `source`/`event`/`audience` triple so the set stays queryable — the
 * analytics phase reads exactly these keys.
 */
export function buildNotificationMetadata(input: NotificationContext): JsonObject {
  const base = {
    source: WORK_REQUEST_NOTIFICATION_SOURCE,
    event: input.event,
    audience: input.audience,
  };

  if (input.audience === "provider") {
    return { ...base, work_request_item_id: input.context.workRequestItemId };
  }

  const metadata: JsonObject = {
    ...base,
    work_request_id: input.context.workRequestId,
  };
  if (input.context.workRequestItemId) {
    metadata.work_request_item_id = input.context.workRequestItemId;
  }
  if (typeof input.context.itemCount === "number") {
    metadata.item_count = input.context.itemCount;
  }
  return metadata;
}

/**
 * Guard for the anonymity boundary (used by P4-2 and its tests).
 *
 * Any key that could tie a provider back to who the work is for. Kept beside
 * the catalog so adding a field to a context type forces a decision here.
 */
export const IDENTITY_KEYS = [
  "work_request_id",
  "workRequestId",
  "organization_id",
  "organizationId",
  "customer_id",
  "customerId",
  "provider_id",
  "providerId",
  "assigned_provider_id",
  "email",
] as const;

/** True if a payload bound for a provider still carries identifying keys. */
export function leaksIdentity(metadata: JsonObject): boolean {
  return IDENTITY_KEYS.some((key) => key in metadata);
}

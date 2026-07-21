import type { JsonObject } from "@/lib/supabase/json";
import {
  buildNotificationMetadata,
  leaksIdentity,
  type WorkRequestNotificationEvent,
} from "./work-request-notifications";

// Anonymity serialization boundary (Phase 4, P4-2)
//
// The single place where a work-request event becomes something a human reads.
// Customer and provider never see each other, so every message is built from
// inputs that cannot name the other side:
//
//   * a customer is told about "your Logistics provider" — the serializer is
//     given a service name, never a provider name, so there is no value it
//     could print even if a message template asked for one
//   * a provider is told about a work order and its service — nothing is
//     accepted that identifies the customer or groups items into a request
//
// The guarantee is structural first (the inputs cannot express the other
// party) and asserted second (assertNoIdentityLeak backstops the metadata).
// Both matter: types stop a mistake at compile time, the assertion catches a
// payload assembled dynamically.

export interface SerializedNotification {
  message: string;
  metadata: JsonObject;
}

/**
 * A stable, opaque handle for an id.
 *
 * Derived from the id itself so it is deterministic and needs no storage, but
 * reveals nothing: it identifies the record to both sides in a support
 * conversation without exposing who is behind it. Matches the 8-character
 * form the provider API (P3-5) already returns.
 */
export function opaqueReference(id: string, prefix: "REQ" | "WO"): string {
  return `${prefix}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** How a customer hears about the provider doing their work. */
export function providerLabel(serviceName: string): string {
  const trimmed = serviceName.trim();
  return trimmed.length > 0 ? `your ${trimmed} provider` : "your provider";
}

/**
 * Throw if a payload crossing the boundary still carries identifying keys.
 *
 * Unreachable when callers use the typed builders — this exists so a payload
 * assembled dynamically, or a context type that gains a field later, fails
 * loudly here instead of quietly reaching the wrong side.
 */
export function assertNoIdentityLeak(
  metadata: JsonObject,
  audience: "customer" | "provider",
): void {
  if (audience !== "provider") return;
  if (leaksIdentity(metadata)) {
    throw new Error(
      "Refusing to send a provider notification carrying customer identity.",
    );
  }
}

// ─── Customer-facing ─────────────────────────────────────────────────────────

export type CustomerNotificationEvent = Exclude<
  WorkRequestNotificationEvent,
  "work_order_assigned"
>;

export interface CustomerNotificationInput {
  event: CustomerNotificationEvent;
  workRequestId: string;
  workRequestItemId?: string;
  /** The work order this message is about. */
  label?: string;
  /**
   * The service performing the work. Used to say "your Logistics provider" —
   * the serializer never receives the provider's name, so it cannot print it.
   */
  serviceName?: string;
  /** The work order this one is waiting behind. */
  blockedByLabel?: string;
  /** How many items the event covers (auto-added count, and similar). */
  itemCount?: number;
}

function customerMessage(input: CustomerNotificationInput): string {
  const label = input.label ?? "A work order";
  const count = input.itemCount ?? 0;

  switch (input.event) {
    case "work_orders_auto_added":
      return count === 1
        ? "We added 1 required step to your request so it can be completed."
        : `We added ${count} required steps to your request so they can be completed.`;

    case "work_order_queued":
      return input.blockedByLabel
        ? `"${label}" is queued — it starts once "${input.blockedByLabel}" is done.`
        : `"${label}" is queued behind other work and will start automatically.`;

    case "work_order_started":
      return input.serviceName
        ? `Work has started on "${label}" with ${providerLabel(input.serviceName)}.`
        : `Work has started on "${label}".`;

    case "work_order_completed":
      return `"${label}" is complete.`;

    case "work_request_completed":
      return `All work orders in request ${opaqueReference(input.workRequestId, "REQ")} are complete.`;
  }
}

export function serializeCustomerNotification(
  input: CustomerNotificationInput,
): SerializedNotification {
  const metadata = buildNotificationMetadata({
    audience: "customer",
    event: input.event,
    context: {
      workRequestId: input.workRequestId,
      workRequestItemId: input.workRequestItemId,
      itemCount: input.itemCount,
    },
  });

  return { message: customerMessage(input), metadata };
}

// ─── Provider-facing ─────────────────────────────────────────────────────────

export interface ProviderNotificationInput {
  event: "work_order_assigned";
  workRequestItemId: string;
  label: string;
  serviceName: string;
}

function providerMessage(input: ProviderNotificationInput): string {
  const reference = opaqueReference(input.workRequestItemId, "WO");
  return `New ${input.serviceName} work order assigned to you: "${input.label}" (${reference}).`;
}

export function serializeProviderNotification(
  input: ProviderNotificationInput,
): SerializedNotification {
  const metadata = buildNotificationMetadata({
    audience: "provider",
    event: input.event,
    context: { workRequestItemId: input.workRequestItemId },
  });

  assertNoIdentityLeak(metadata, "provider");

  return { message: providerMessage(input), metadata };
}

import type { AppSupabaseClient as SupabaseClient } from "@/lib/supabase/types";
import {
  insertNotifications,
  resolveCustomerUserIds,
  resolvePartnerUserIds,
} from "@/lib/workflow/order-lifecycle";
import {
  serializeCustomerNotification,
  serializeProviderNotification,
  type CustomerNotificationEvent,
} from "@/features/notifications/anonymity";

// Notification emission (Phase 4, P4-3)
//
// Delivers the catalog's moments (P4-1) to the right actor, with every message
// built by the anonymity boundary (P4-2) so neither side can name the other.
//
// Emission is inline rather than queued. The workflow queue has no scheduler —
// it only drains when something calls /api/system/workflow/dispatch — so a
// queued notification would sit undelivered indefinitely. It is also
// deliberately non-fatal: a failure to tell someone about work must never roll
// back the work itself, so every function here logs and returns rather than
// throwing into the caller's transaction.

/** Tell the customer behind a work request about one of its moments. */
export async function notifyCustomer(
  admin: SupabaseClient,
  input: {
    workRequestId: string;
    event: CustomerNotificationEvent;
    workRequestItemId?: string;
    label?: string;
    /** Service performing the work — rendered as "your <service> provider". */
    serviceName?: string;
    blockedByLabel?: string;
    itemCount?: number;
  },
): Promise<void> {
  try {
    const { data: request, error } = await admin
      .from("work_requests")
      .select("id, organization_id")
      .eq("id", input.workRequestId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!request?.organization_id) return;

    const userIds = await resolveCustomerUserIds(admin, request.organization_id);
    if (userIds.length === 0) return;

    const { message, metadata } = serializeCustomerNotification({
      event: input.event,
      workRequestId: input.workRequestId,
      workRequestItemId: input.workRequestItemId,
      label: input.label,
      serviceName: input.serviceName,
      blockedByLabel: input.blockedByLabel,
      itemCount: input.itemCount,
    });

    await insertNotifications(
      admin,
      userIds.map((userId) => ({
        userId,
        organizationId: request.organization_id,
        message,
        metadata,
      })),
    );
  } catch (err) {
    console.error(
      `[work-request-notifications] Failed to notify customer (${input.event}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Tell a provider that work has been routed to them.
 *
 * Takes no work request or organization: there is no argument through which
 * the customer could reach this message.
 */
export async function notifyProvider(
  admin: SupabaseClient,
  input: {
    providerId: string;
    workRequestItemId: string;
    label: string;
    serviceName: string;
  },
): Promise<void> {
  try {
    const userIds = await resolvePartnerUserIds(admin, [input.providerId]);
    if (userIds.length === 0) return;

    const { message, metadata } = serializeProviderNotification({
      event: "work_order_assigned",
      workRequestItemId: input.workRequestItemId,
      label: input.label,
      serviceName: input.serviceName,
    });

    await insertNotifications(
      admin,
      userIds.map((userId) => ({
        userId,
        // Null keeps the provider's notification untied to the customer's org.
        organizationId: null,
        message,
        metadata,
      })),
    );
  } catch (err) {
    console.error(
      "[work-request-notifications] Failed to notify provider:",
      err instanceof Error ? err.message : err,
    );
  }
}

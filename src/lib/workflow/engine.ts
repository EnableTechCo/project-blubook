import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSalesWorkflowEvent,
  processSalesWorkflowEvent,
} from "@/lib/workflow/sales-events";
import {
  isLogisticsWorkflowEvent,
  processLogisticsWorkflowEvent,
} from "@/lib/workflow/logistics-events";
import {
  isRequestWorkflowEvent,
  processRequestWorkflowEvent,
} from "@/lib/workflow/request-events";
import type { WorkflowEventType, WorkflowPayload } from "@/lib/workflow/types";

// Backoff schedule applied after each failed attempt, indexed by the retry
// attempt number (1st failure -> index 0). After the schedule is exhausted,
// the event is retried using the last interval.
const RETRY_BACKOFF_MINUTES = [1, 5, 15];

export type { WorkflowEventType } from "@/lib/workflow/types";

export async function queueWorkflowEvent(
  eventType: WorkflowEventType,
  payload: WorkflowPayload,
) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workflow_events_queue")
    .insert({
      event_type: eventType,
      payload,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not queue workflow event.");
  }

  return data.id;
}

export async function processWorkflowEvents(limit = 10) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Fetch oldest queued events that are due — either never attempted
  // (next_retry_at is null) or past their scheduled retry time.
  const { data: events, error: fetchError } = await admin
    .from("workflow_events_queue")
    .select("id, event_type, payload, retry_count, max_retries")
    .eq("status", "queued")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchError) {
    throw new Error(`Failed to fetch workflow events: ${fetchError.message}`);
  }

  if (!events || events.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, retried: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  let retried = 0;

  for (const event of events) {
    const eventId = event.id;
    const eventType = event.event_type as WorkflowEventType;
    const payload = (event.payload ?? {}) as WorkflowPayload;
    const retryCount = (event.retry_count as number | null) ?? 0;
    const maxRetries = (event.max_retries as number | null) ?? 3;

    // Mark as processing
    await admin
      .from("workflow_events_queue")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    try {
      if (isSalesWorkflowEvent(eventType)) {
        await processSalesWorkflowEvent(eventType, payload, queueWorkflowEvent);
      } else if (isLogisticsWorkflowEvent(eventType)) {
        await processLogisticsWorkflowEvent(
          eventType,
          payload,
          queueWorkflowEvent,
        );
      } else if (isRequestWorkflowEvent(eventType)) {
        await processRequestWorkflowEvent(eventType, payload);
      } else {
        throw new Error(`Unhandled event type: ${eventType}`);
      }

      // Mark event as completed
      await admin
        .from("workflow_events_queue")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);

      succeeded += 1;
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Unknown workflow error";
      const nextRetryCount = retryCount + 1;

      if (nextRetryCount < maxRetries) {
        // Retry-eligible: back off and re-queue. Picked up automatically the
        // next time dispatch runs (no separate scheduler required).
        const backoffMinutes =
          RETRY_BACKOFF_MINUTES[
            Math.min(nextRetryCount - 1, RETRY_BACKOFF_MINUTES.length - 1)
          ];
        const nextRetryAt = new Date(
          Date.now() + backoffMinutes * 60_000,
        ).toISOString();

        await admin
          .from("workflow_events_queue")
          .update({
            status: "queued",
            retry_count: nextRetryCount,
            next_retry_at: nextRetryAt,
            error_message: errMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventId);

        retried += 1;
      } else {
        // Retry budget exhausted — terminal failure, needs manual review.
        await admin
          .from("workflow_events_queue")
          .update({
            status: "failed",
            retry_count: nextRetryCount,
            error_message: `${errMsg} (retry budget exhausted after ${nextRetryCount} attempts)`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventId);

        failed += 1;
      }
    }
  }

  return { processed: events.length, succeeded, failed, retried };
}

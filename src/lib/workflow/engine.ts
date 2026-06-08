import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSalesWorkflowEvent,
  processSalesWorkflowEvent,
} from "@/lib/workflow/sales-events";
import {
  isLogisticsWorkflowEvent,
  processLogisticsWorkflowEvent,
} from "@/lib/workflow/logistics-events";
import type { WorkflowEventType, WorkflowPayload } from "@/lib/workflow/types";

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

  // Fetch oldest queued workflow events
  const { data: events, error: fetchError } = await admin
    .from("workflow_events_queue")
    .select("id, event_type, payload")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchError) {
    throw new Error(`Failed to fetch workflow events: ${fetchError.message}`);
  }

  if (!events || events.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const event of events) {
    const eventId = event.id;
    const eventType = event.event_type as WorkflowEventType;
    const payload = (event.payload ?? {}) as WorkflowPayload;

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
      await admin
        .from("workflow_events_queue")
        .update({
          status: "failed",
          error_message: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);

      failed += 1;
    }
  }

  return { processed: events.length, succeeded, failed };
}

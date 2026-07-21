import { createAdminClient } from "@/lib/supabase/admin";
import { asJsonObject, requireJsonString } from "@/lib/supabase/json";
import {
  insertNotifications,
  resolveCustomerUserIds,
} from "@/lib/workflow/order-lifecycle";
import type { RequestWorkflowEventType, WorkflowEventType, WorkflowPayload } from "@/lib/workflow/types";

export function isRequestWorkflowEvent(
  eventType: WorkflowEventType,
): eventType is RequestWorkflowEventType {
  return eventType === "request.acknowledged" || eventType === "request.rejected";
}

export async function processRequestWorkflowEvent(
  eventType: RequestWorkflowEventType,
  payload: WorkflowPayload,
) {
  const requestId = requireJsonString(payload, "requestId");

  const admin = createAdminClient();

  const { data: request, error } = await admin
    .from("customer_provider_requests")
    .select("id, organization_id, package_stream, metadata")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    throw new Error(`Request ${requestId} not found: ${error?.message}`);
  }

  const metadata = asJsonObject(request.metadata);

  const partnerName =
    typeof metadata.provider_name === "string" && metadata.provider_name.length > 0
      ? metadata.provider_name
      : "your service partner";

  const message =
    eventType === "request.acknowledged"
      ? `${partnerName} accepted your ${request.package_stream} request and will begin work shortly.`
      : `${partnerName} was unable to accept your ${request.package_stream} request. Our team will follow up on next steps.`;

  const customerUserIds = await resolveCustomerUserIds(
    admin,
    request.organization_id,
  );

  await insertNotifications(
    admin,
    customerUserIds.map((userId) => ({
      userId,
      organizationId: request.organization_id,
      message,
      metadata: {
        source: "request_workflow_event",
        request_id: requestId,
        event_type: eventType,
      },
    })),
  );
}

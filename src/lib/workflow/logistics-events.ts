import { createAdminClient } from "@/lib/supabase/admin";
import {
  appendOrderTimeline,
  computeDeliveredOrderMetadata,
  insertNotifications,
  readStringMetadata,
  resolveCustomerUserIds,
  resolvePartnerUserIds,
  resolveStaffAdminUserIds,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";
import type {
  LogisticsWorkflowEventType,
  WorkflowEventType,
  WorkflowPayload,
  QueueWorkflowEvent,
} from "@/lib/workflow/types";

export function isLogisticsWorkflowEvent(
  eventType: WorkflowEventType,
): eventType is LogisticsWorkflowEventType {
  return (
    eventType === "logistics.handoff_created" ||
    eventType === "logistics.order_received" ||
    eventType === "order.shipped" ||
    eventType === "order.delivered"
  );
}

export async function processLogisticsWorkflowEvent(
  eventType: LogisticsWorkflowEventType,
  payload: WorkflowPayload,
  queueWorkflowEvent: QueueWorkflowEvent,
) {
  const admin = createAdminClient();

  switch (eventType) {
    case "logistics.handoff_created": {
      const { handoffId, orderId } = payload;
      if (!handoffId || !orderId) {
        throw new Error("Missing handoffId or orderId in payload");
      }

      await admin
        .from("sales_orders")
        .update({
          status: "Logistics Handoff Created",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      const { data: order } = await admin
        .from("sales_orders")
        .select("metadata, po_reference")
        .eq("id", orderId)
        .maybeSingle();

      if (order) {
        const metadata = appendOrderTimeline(
          withOrderLifecycleDefaults(order.metadata),
          {
            step: "logistics_order_received",
            actor: "logistics",
            message: `${order.po_reference ?? orderId} was received by logistics.`,
          },
        );

        await admin
          .from("sales_orders")
          .update({ metadata, updated_at: new Date().toISOString() })
          .eq("id", orderId);
      }

      return;
    }

    case "logistics.order_received": {
      const { orderId } = payload;
      if (!orderId) throw new Error("Missing orderId in payload");

      await admin
        .from("sales_orders")
        .update({
          status: "Order Received",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      return;
    }

    case "order.shipped": {
      const { orderId } = payload;
      if (!orderId) throw new Error("Missing orderId in payload");

      await admin
        .from("sales_orders")
        .update({
          status: "Track Shipment In Transit",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      const { data: order } = await admin
        .from("sales_orders")
        .select("metadata, po_reference")
        .eq("id", orderId)
        .maybeSingle();

      if (order) {
        const metadata = appendOrderTimeline(
          withOrderLifecycleDefaults(order.metadata),
          {
            step: "shipment_in_transit",
            actor: "logistics",
            message: `${order.po_reference ?? orderId} is now in transit.`,
          },
        );

        await admin
          .from("sales_orders")
          .update({ metadata, updated_at: new Date().toISOString() })
          .eq("id", orderId);
      }

      await queueWorkflowEvent("order.delivered", { orderId });
      return;
    }

    case "order.delivered": {
      const { orderId } = payload;
      if (!orderId) throw new Error("Missing orderId in payload");

      const { data: order, error: orderError } = await admin
        .from("sales_orders")
        .select("id, organization_id, po_reference, metadata")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        throw new Error(`Order ${orderId} not found: ${orderError?.message}`);
      }

      const { data: completedHandoff } = await admin
        .from("provider_workflow_handoffs")
        .select("completed_at, metadata, from_provider_id, to_provider_id")
        .eq("sales_order_id", orderId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const deliveredAt =
        completedHandoff?.completed_at ?? new Date().toISOString();
      const deliveredTo =
        (completedHandoff?.metadata &&
        typeof completedHandoff.metadata === "object" &&
        typeof completedHandoff.metadata.target_provider_name === "string"
          ? completedHandoff.metadata.target_provider_name
          : null) ??
        readStringMetadata(order.metadata, "current_logistics_partner_name") ??
        "the assigned logistics partner";

      const deliveredMetadata = computeDeliveredOrderMetadata(order.metadata, {
        deliveredAt,
        deliveredTo,
      });
      const timelineMetadata = appendOrderTimeline(deliveredMetadata, {
        step: "order_delivered",
        actor: "logistics",
        at: deliveredAt,
        message: `${order.po_reference ?? orderId} was delivered to ${deliveredTo}. SLA ${deliveredMetadata.sla_status}.`,
        details: {
          deliveredTo,
          deliveredAt,
          slaDueAt: deliveredMetadata.sla_due_at,
          slaStatus: deliveredMetadata.sla_status,
        },
      });

      await admin
        .from("sales_orders")
        .update({
          status: "Delivered",
          metadata: timelineMetadata,
          updated_at: deliveredAt,
        })
        .eq("id", orderId);

      const customerUserIds = await resolveCustomerUserIds(
        admin,
        order.organization_id,
      );
      const staffAdminUserIds = await resolveStaffAdminUserIds(
        admin,
        order.organization_id,
      );
      const partnerUserIds = await resolvePartnerUserIds(
        admin,
        [
          completedHandoff?.from_provider_id,
          completedHandoff?.to_provider_id,
        ].filter((value): value is string => Boolean(value)),
      );
      const poLabel = order.po_reference ?? orderId;
      const finalMessage = `${poLabel} was delivered to ${deliveredTo}. SLA ${deliveredMetadata.sla_status}.`;

      await insertNotifications(admin, [
        ...customerUserIds.map((userId) => ({
          userId,
          organizationId: order.organization_id,
          message: finalMessage,
          metadata: {
            source: "logistics_order_delivered",
            order_id: orderId,
            delivered_to: deliveredTo,
            delivered_at: deliveredAt,
            sla_status: deliveredMetadata.sla_status,
          },
        })),
        ...partnerUserIds.map((userId) => ({
          userId,
          organizationId: order.organization_id,
          message: `${poLabel} delivery closed with SLA ${deliveredMetadata.sla_status}.`,
          metadata: {
            source: "logistics_order_delivered",
            order_id: orderId,
            delivered_to: deliveredTo,
            delivered_at: deliveredAt,
            sla_status: deliveredMetadata.sla_status,
          },
        })),
        ...staffAdminUserIds.map((userId) => ({
          userId,
          organizationId: order.organization_id,
          message: `${poLabel} delivered to ${deliveredTo}. SLA ${deliveredMetadata.sla_status}.`,
          metadata: {
            source: "logistics_order_delivered",
            order_id: orderId,
            delivered_to: deliveredTo,
            delivered_at: deliveredAt,
            sla_status: deliveredMetadata.sla_status,
          },
        })),
      ]);

      return;
    }
  }
}

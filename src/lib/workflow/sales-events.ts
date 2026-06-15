import { createAdminClient } from "@/lib/supabase/admin";
import {
  appendOrderTimeline,
  insertNotifications,
  resolveCustomerUserIds,
  resolvePartnerUserIds,
  withOrderLifecycleDefaults,
} from "@/lib/workflow/order-lifecycle";
import { resolveServicePartnerForStream } from "@/lib/workflow/service-partner-routing";
import { assertValidTransition } from "@/lib/workflow/transition-validator";
import type {
  QueueWorkflowEvent,
  SalesWorkflowEventType,
  WorkflowEventType,
  WorkflowPayload,
} from "@/lib/workflow/types";

const SALES_PARTNER_STREAM = "Sales Ops";
const LOGISTICS_PARTNER_STREAM = "Logistics";
const DEFAULT_LOGISTICS_PARTNER_NAME_HINT = "blubook logistics";
const LOGISTICS_OWNED_STATUSES = new Set([
  "Logistics Handoff Created",
  "Service Provider Confirmed Order",
  "Logistics Fulfillment In Progress",
  "Order Received",
  "Order Transmitted to Warehouse",
  "Notify Customer",
  "Pack Items for Shipment",
  "Generate Shipping Label & Documentation",
  "Track Shipment In Transit",
  "Reroute Delivery",
  "Order Arrives at Destination",
  "Customer Receives & Signs POD",
  "BluBook System Updated",
]);

async function assertSalesCompletionUnlocked(orderId: string) {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("sales_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  if (order.status === "Delivered") {
    return;
  }

  if (LOGISTICS_OWNED_STATUSES.has(order.status)) {
    throw new Error(
      `Sales completion is blocked while logistics owns delivery execution (current status: ${order.status}). Wait until logistics sets Delivered.`,
    );
  }
}

export function isSalesWorkflowEvent(
  eventType: WorkflowEventType,
): eventType is SalesWorkflowEventType {
  return (
    eventType === "order.created" ||
    eventType === "order.validated" ||
    eventType === "order.routed" ||
    eventType === "task.started" ||
    eventType === "task.completed" ||
    eventType === "order.packaged"
  );
}

export async function processSalesWorkflowEvent(
  eventType: SalesWorkflowEventType,
  payload: WorkflowPayload,
  queueWorkflowEvent: QueueWorkflowEvent,
) {
  const admin = createAdminClient();

  switch (eventType) {
    case "order.created": {
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

      const nowIso = new Date().toISOString();
      const nextMetadata = appendOrderTimeline(
        withOrderLifecycleDefaults(order.metadata, { startedAt: nowIso }),
        {
          step: "order_created",
          actor: "sales",
          at: nowIso,
          message: `Order ${order.po_reference ?? orderId} received and awaiting sales validation.`,
        },
      );

      // Set to initial received state. Sales must explicitly validate via the UI
      // checkpoint to trigger order.validated — prevents double-processing.
      await admin
        .from("sales_orders")
        .update({
          status: "Purchase Order Received",
          metadata: nextMetadata,
          updated_at: nowIso,
        })
        .eq("id", orderId);

      return;
    }

    case "order.validated": {
      const orderId =
        typeof payload.orderId === "string" ? payload.orderId : null;
      if (!orderId) throw new Error("Missing orderId in payload");

      await assertValidTransition(orderId, eventType);

      const { data: order, error: orderError } = await admin
        .from("sales_orders")
        .select("id, organization_id, po_reference, metadata")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        throw new Error(`Order ${orderId} not found: ${orderError?.message}`);
      }

      const { data: items, error: itemsError } = await admin
        .from("sales_order_items")
        .select("id, fulfillment_route, quantity, product_name")
        .eq("order_id", orderId);

      if (itemsError || !items || items.length === 0) {
        throw new Error(`Order items not found for order ${orderId}`);
      }

      let hasPick = false;
      let hasProduce = false;
      let hasLogisticsHandoff = false;

      const partner = await resolveServicePartnerForStream({
        admin,
        stream: SALES_PARTNER_STREAM,
      });

      let assignedLogisticsProvider: {
        id: string;
        packageStream: string;
        name: string;
      } | null = null;

      for (const item of items) {
        if (item.fulfillment_route === "pick") {
          hasPick = true;
          await admin.from("pick_tickets").insert({
            order_item_id: item.id,
            bin_location: "Zone-A-Bin-" + Math.floor(Math.random() * 20 + 1),
            status: "pending",
            picked_quantity: 0,
          });
        } else if (item.fulfillment_route === "produce") {
          hasProduce = true;
          await admin.from("work_orders").insert({
            order_item_id: item.id,
            status: "pending",
            quantity_to_build: item.quantity,
          });
        } else if (item.fulfillment_route === "order") {
          if (!partner?.id) {
            throw new Error(
              `No active service partner available for stream ${SALES_PARTNER_STREAM}`,
            );
          }

          const logisticsProvider = await resolveServicePartnerForStream({
            admin,
            stream: LOGISTICS_PARTNER_STREAM,
            preferredNameHint: DEFAULT_LOGISTICS_PARTNER_NAME_HINT,
          });

          if (!logisticsProvider?.id) {
            throw new Error("No active logistics service partner available");
          }

          hasLogisticsHandoff = true;
          assignedLogisticsProvider = logisticsProvider;

          const requiredDocuments = [
            {
              key: "shipping-label",
              label: "Shipping Label",
            },
            {
              key: "proof-of-delivery",
              label: "Proof of Delivery",
            },
          ];

          await admin.from("provider_workflow_handoffs").insert({
            sales_order_id: orderId,
            order_item_id: item.id,
            organization_id: order.organization_id,
            from_provider_id: partner.id,
            to_provider_id: logisticsProvider.id,
            handoff_type: "sales_to_logistics",
            package_stream: logisticsProvider.packageStream,
            status: "pending",
            required_documents: requiredDocuments,
            metadata: {
              source_provider_name: partner.name,
              target_provider_name: logisticsProvider.name,
              source_handoff_type: "order.validated",
              item_name: item.product_name,
              fulfillment_route: item.fulfillment_route,
            },
          });
        }
      }

      let nextState = "Inventory Reserved";
      if (hasLogisticsHandoff) {
        nextState = "Logistics Handoff Created";
      } else if (hasProduce) {
        nextState = "Work Order Created";
      } else if (hasPick) {
        nextState = "Pick Ticket Generated";
      }

      await admin
        .from("sales_orders")
        .update({
          metadata: hasLogisticsHandoff
            ? appendOrderTimeline(
                {
                  ...withOrderLifecycleDefaults(order.metadata),
                  current_logistics_partner_name:
                    assignedLogisticsProvider?.name ?? null,
                },
                {
                  step: "logistics_handoff_created",
                  actor: "sales",
                  message: `${order.po_reference ?? orderId} was handed to ${assignedLogisticsProvider?.name ?? "logistics"}.`,
                  details: {
                    logisticsPartnerName:
                      assignedLogisticsProvider?.name ?? null,
                  },
                },
              )
            : withOrderLifecycleDefaults(order.metadata),
          status: nextState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (hasLogisticsHandoff && partner?.id && assignedLogisticsProvider?.id) {
        const customerUserIds = await resolveCustomerUserIds(
          admin,
          order.organization_id,
        );
        const [salesUserIds, logisticsUserIds] = await Promise.all([
          resolvePartnerUserIds(admin, [partner.id]),
          resolvePartnerUserIds(admin, [assignedLogisticsProvider.id]),
        ]);

        const poLabel = order.po_reference ?? orderId;
        await insertNotifications(admin, [
          ...customerUserIds.map((userId) => ({
            userId,
            organizationId: order.organization_id,
            message: `${poLabel} cleared sales validation and was handed to ${assignedLogisticsProvider.name}.`,
            metadata: {
              source: "sales_workflow_handoff_created",
              order_id: orderId,
            },
          })),
          ...salesUserIds.map((userId) => ({
            userId,
            organizationId: order.organization_id,
            message: `${poLabel} was handed to ${assignedLogisticsProvider.name} for delivery.`,
            metadata: {
              source: "sales_workflow_handoff_created",
              order_id: orderId,
            },
          })),
          ...logisticsUserIds.map((userId) => ({
            userId,
            organizationId: order.organization_id,
            message: `New inbound handoff received for ${poLabel} from ${partner.name}.`,
            metadata: {
              source: "sales_workflow_handoff_created",
              order_id: orderId,
            },
          })),
        ]);
      }

      return;
    }

    case "order.routed": {
      return;
    }

    case "task.started": {
      const { taskId, taskType } = payload;
      if (!taskId || !taskType) throw new Error("Missing taskId or taskType");

      if (taskType === "work_order") {
        const { data: wo, error: woError } = await admin
          .from("work_orders")
          .update({
            status: "manufacturing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .select("order_item_id")
          .single();

        if (woError || !wo) throw new Error("Work order not found");

        const { data: item } = await admin
          .from("sales_order_items")
          .select("order_id")
          .eq("id", wo.order_item_id)
          .single();

        if (item) {
          await admin
            .from("sales_orders")
            .update({
              status: "Manufacturing",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.order_id);
        }
      }

      return;
    }

    case "task.completed": {
      const { taskId, taskType, quantity, userId } = payload;
      if (!taskId || !taskType) throw new Error("Missing taskId or taskType");

      let orderItemId = "";
      let orderId = "";

      if (taskType === "pick_ticket") {
        const { data: ticket, error: ticketError } = await admin
          .from("pick_tickets")
          .update({
            status: "completed",
            picked_quantity: quantity,
            picked_by: userId || null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .select("order_item_id")
          .single();

        if (ticketError || !ticket) throw new Error("Pick ticket not found");
        orderItemId = ticket.order_item_id;

        await admin.from("fulfillment_logs").insert({
          order_item_id: orderItemId,
          source_type: "pick_ticket",
          source_id: taskId,
          received_quantity: quantity,
          received_by: userId || null,
        });
      } else if (taskType === "work_order") {
        const { data: wo, error: woError } = await admin
          .from("work_orders")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .select("order_item_id, quantity_to_build")
          .single();

        if (woError || !wo) throw new Error("Work order not found");
        orderItemId = wo.order_item_id;

        await admin.from("fulfillment_logs").insert({
          order_item_id: orderItemId,
          source_type: "work_order",
          source_id: taskId,
          received_quantity: wo.quantity_to_build,
          received_by: userId || null,
        });
      } else if (taskType === "purchase_order") {
        const { data: po, error: poError } = await admin
          .from("purchase_order_items")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .select("order_item_id, ordered_quantity")
          .single();

        if (poError || !po) throw new Error("Purchase order not found");
        orderItemId = po.order_item_id;

        await admin.from("fulfillment_logs").insert({
          order_item_id: orderItemId,
          source_type: "purchase_order",
          source_id: taskId,
          received_quantity: po.ordered_quantity,
          received_by: userId || null,
        });
      }

      const { data: item } = await admin
        .from("sales_order_items")
        .select("order_id")
        .eq("id", orderItemId)
        .single();

      if (!item) throw new Error("Order item not associated with any order");
      orderId = item.order_id;

      await assertSalesCompletionUnlocked(orderId);

      const { data: orderItems } = await admin
        .from("sales_order_items")
        .select("id, quantity")
        .eq("order_id", orderId);

      const { data: logs } = await admin
        .from("fulfillment_logs")
        .select("order_item_id, received_quantity")
        .in(
          "order_item_id",
          (orderItems ?? []).map((oi) => oi.id),
        );

      const itemCompletionMap = new Map<string, number>();
      logs?.forEach((log) => {
        const current = itemCompletionMap.get(log.order_item_id) ?? 0;
        itemCompletionMap.set(
          log.order_item_id,
          current + log.received_quantity,
        );
      });

      const isFullyFulfilling = (orderItems ?? []).every((oi) => {
        const received = itemCompletionMap.get(oi.id) ?? 0;
        return received >= oi.quantity;
      });

      if (isFullyFulfilling) {
        await admin
          .from("sales_orders")
          .update({
            status: "Packaging",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        await queueWorkflowEvent("order.packaged", { orderId });
      }

      return;
    }

    case "order.packaged": {
      const orderId =
        typeof payload.orderId === "string" ? payload.orderId : null;
      if (!orderId) throw new Error("Missing orderId in payload");

      await assertValidTransition(orderId, eventType);
      await assertSalesCompletionUnlocked(orderId);

      const { data: order, error: orderError } = await admin
        .from("sales_orders")
        .select("id, organization_id, total_cents, currency_code")
        .eq("id", orderId)
        .single();

      if (orderError || !order) throw new Error("Order not found");

      const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { data: invoice } = await admin
        .from("invoices")
        .insert({
          organization_id: order.organization_id,
          invoice_number: invoiceNumber,
          status: "issued",
          currency_code: order.currency_code,
          total_cents: order.total_cents,
          subtotal_cents: order.total_cents,
          billing_reason: "order_fulfillment",
          due_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          issued_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (invoice) {
        const { data: orderItems } = await admin
          .from("sales_order_items")
          .select("product_name, quantity, unit_price_cents")
          .eq("order_id", orderId);

        for (const item of orderItems ?? []) {
          await admin.from("invoice_line_items").insert({
            invoice_id: invoice.id,
            description: item.product_name,
            quantity: item.quantity,
            unit_amount_cents: item.unit_price_cents,
            line_total_cents: item.quantity * item.unit_price_cents,
          });
        }
      }

      await admin
        .from("sales_orders")
        .update({
          status: "Invoice Generated",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      // Do NOT auto-queue logistics.order_received here. Logistics must
      // explicitly acknowledge intake via their own action. Removing this
      // was required to prevent logistics-owned steps from auto-completing.
      return;
    }
  }
}

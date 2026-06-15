import { useMemo } from "react";
import {
  isPendingRequirement,
  isPurchaseOrderRequirement,
} from "@/lib/workflow/requirement-filters";

type CustomerRequirement = {
  id: string;
  title: string;
  evidenceType: string;
  status: string;
  isRequired: boolean;
};

type CustomerOrderSummary = {
  id: string;
  status: string;
  poReference: string | null;
  updatedAt: string;
  deliveredAt?: string | null;
  timeline?: Array<{ step?: string }>;
};

export function useCustomerDashboardData(input: {
  orders: CustomerOrderSummary[];
  requirements: CustomerRequirement[];
}) {
  return useMemo(() => {
    const normalizeStatus = (value: string) => value.trim().toLowerCase();
    const hasTimelineStep = (
      timeline: Array<{ step?: string }> | undefined,
      target: string,
    ) =>
      (timeline ?? []).some(
        (entry) =>
          typeof entry?.step === "string" &&
          entry.step.trim().toLowerCase() === target,
      );

    const isDeliveredOrder = (order: CustomerOrderSummary) => {
      const normalized = normalizeStatus(order.status);
      return (
        normalized === "delivered" ||
        Boolean(order.deliveredAt) ||
        hasTimelineStep(order.timeline, "order_delivered") ||
        hasTimelineStep(order.timeline, "logistics_order_delivered")
      );
    };

    const sortedOrders = [...input.orders].sort((a, b) => {
      return (
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime()
      );
    });

    const activeOrders = sortedOrders.filter((order) => {
      const normalized = normalizeStatus(order.status);
      return !isDeliveredOrder(order) && normalized !== "cancelled";
    });

    const completedOrders = sortedOrders.filter((order) => {
      return isDeliveredOrder(order);
    });

    const pendingPurchaseOrders = input.requirements.filter(
      (item) =>
        item.isRequired &&
        isPendingRequirement(item.status) &&
        isPurchaseOrderRequirement({
          title: item.title,
          evidenceType: item.evidenceType,
        }),
    );

    return {
      activeOrders,
      completedOrders,
      pendingPurchaseOrders,
      displayedOrderId: activeOrders[0]?.id ?? sortedOrders[0]?.id ?? null,
    };
  }, [input.orders, input.requirements]);
}

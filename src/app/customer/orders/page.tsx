"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCustomerContext } from "@/hooks/use-customer-context";

type CustomerOrder = {
  id: string;
  status: string;
  totalCents: number;
  currencyCode: string;
  poReference: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  deliveredTo: string | null;
  slaDueAt: string | null;
  slaStatus: string | null;
  timeline: Array<{
    id?: string;
    step?: string;
    actor?: string;
    message?: string;
    at?: string;
  }>;
};

function formatMoney(amountCents: number, currencyCode: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currencyCode,
  }).format(amountCents / 100);
}

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .join(" ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export default function CustomerOrdersPage() {
  const customerContext = useCustomerContext();

  const ordersQuery = useQuery({
    queryKey: ["customer-orders", customerContext.data?.organizationId],
    enabled: Boolean(customerContext.data?.organizationId),
    queryFn: async (): Promise<CustomerOrder[]> => {
      const response = await fetch("/api/customer/orders", {
        method: "GET",
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load customer orders.");
      }

      return (body?.orders ?? []) as CustomerOrder[];
    },
  });

  if (customerContext.isLoading || ordersQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading orders...</p>;
  }

  if (customerContext.isError || ordersQuery.isError) {
    return (
      <p className="text-sm text-red-300">
        {ordersQuery.error instanceof Error
          ? ordersQuery.error.message
          : "Could not load customer orders."}
      </p>
    );
  }

  const orders = ordersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-white">Customer Orders</h2>
        <p className="mt-1 text-sm text-slate-200/85">
          Final delivery history, SLA outcomes, and order timeline.
        </p>
      </div>

      {orders.length === 0 ? (
        <Card
          title="No orders yet"
          description="Upload a purchase order to start the delivery workflow."
        >
          <p className="text-sm text-slate-300">
            Orders will appear here once sales and logistics process your PO.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              title={order.poReference ?? order.id}
              description={`Updated ${new Date(order.updatedAt).toLocaleString()}`}
            >
              <div className="flex flex-wrap gap-2 pb-4">
                <Badge>{formatStatusLabel(order.status)}</Badge>
                {order.slaStatus ? (
                  <Badge>
                    SLA {order.slaStatus === "met" ? "Met" : "Missed"}
                  </Badge>
                ) : null}
                <Badge>{formatMoney(order.totalCents, order.currencyCode)}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    Delivered To
                  </p>
                  <p className="mt-1 text-sm text-slate-100">
                    {order.deliveredTo ?? "In progress"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    Delivered At
                  </p>
                  <p className="mt-1 text-sm text-slate-100">
                    {order.deliveredAt
                      ? new Date(order.deliveredAt).toLocaleString()
                      : "Awaiting delivery"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                    SLA Due
                  </p>
                  <p className="mt-1 text-sm text-slate-100">
                    {order.slaDueAt
                      ? new Date(order.slaDueAt).toLocaleString()
                      : "Not started"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">History</h3>
                {order.timeline.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    No timeline events recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {order.timeline.map((event, index) => (
                      <div
                        key={typeof event.id === "string" ? event.id : `${order.id}-${index}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {typeof event.message === "string"
                              ? event.message
                              : "Workflow update"}
                          </p>
                          <p className="text-[11px] text-slate-300">
                            {typeof event.at === "string"
                              ? new Date(event.at).toLocaleString()
                              : "Unknown time"}
                          </p>
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                          {typeof event.actor === "string"
                            ? event.actor
                            : "system"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
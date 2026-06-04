"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCustomerContext } from "@/hooks/use-customer-context";
import {
  listNotifications,
  markNotificationRead,
} from "@/services/notifications.service";
import { listCustomerRequests } from "@/services/requests.service";

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

function formatNotificationMessage(message: string) {
  return message
    .replace(/\bfinance\b/gi, "Finance")
    .replace(/\bsales ops\b/gi, "Sales Ops")
    .replace(/\bmarketing\b/gi, "Marketing")
    .replace(/\blegal\b/gi, "Legal")
    .replace(/\bhr\b/g, "HR")
    .replace(/\bhr\b/gi, "HR");
}

export default function CustomerMessagesPage() {
  const customerContext = useCustomerContext();
  const notificationsQuery = useQuery({
    queryKey: ["customer-notifications", customerContext.data?.userId],
    enabled: Boolean(customerContext.data?.userId),
    queryFn: () => listNotifications(customerContext.data!.userId),
  });

  const requestsQuery = useQuery({
    queryKey: ["customer-requests", customerContext.data?.userId],
    enabled: Boolean(customerContext.data?.userId),
    queryFn: () => listCustomerRequests(customerContext.data!.userId),
  });

  if (customerContext.isLoading) {
    return <p className="text-sm text-slate-300">Loading messages...</p>;
  }

  if (customerContext.isError || !customerContext.data) {
    return (
      <p className="text-sm text-red-300">
        Could not load your customer messages right now.
      </p>
    );
  }

  const notifications = notificationsQuery.data ?? [];
  const openRequests = (requestsQuery.data ?? []).filter(
    (item) => !["completed", "cancelled"].includes(item.status),
  );

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Customer Messages
          </h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <Card
          title="Notifications"
          description="Real customer notifications from your workspace."
        >
          <div className="space-y-2">
            {notifications.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  item.read_at
                    ? "border-white/10 bg-white/5 text-slate-200"
                    : "border-coral/50 bg-coral/15 text-white"
                }`}
                onClick={() => {
                  void markNotificationRead({
                    notificationId: item.id,
                    userId: customerContext.data.userId,
                  }).then(() => {
                    void notificationsQuery.refetch();
                  });
                }}
              >
                <p>{formatNotificationMessage(item.message)}</p>
                <p className="mt-1 text-[11px] text-slate-300">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </button>
            ))}
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-300">No notifications yet.</p>
            ) : null}
          </div>
        </Card>

        <Card
          title="Active Requests"
          description="Open request activity from the database-backed customer queue."
        >
          <div className="space-y-3">
            {openRequests.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Status: {formatStatusLabel(item.status)}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Updated: {new Date(item.updated_at).toLocaleString()}
                </p>
                <div className="mt-2">
                  <Link href={`/customer/requests/${item.id}`}>
                    <Button>Open request</Button>
                  </Link>
                </div>
              </div>
            ))}
            {openRequests.length === 0 ? (
              <p className="text-sm text-slate-300">No active requests yet.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MOCK_SUITE_OWNERS } from "@/features/mock/dashboard-data";
import { useCustomerJourneyStore } from "@/store/customer-journey-store";

function formatSuiteLabel(value: string) {
  if (value === "sales_ops") {
    return "Sales Ops";
  }

  if (value === "hr") {
    return "HR";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PartnerDashboardPage() {
  const { suiteRequests, partnerNotifications } = useCustomerJourneyStore();

  const metrics = useMemo(() => {
    const pendingReview = suiteRequests.filter(
      (item) => item.status === "pending_partner_review",
    ).length;
    const openQueue = suiteRequests.filter(
      (item) => !["completed", "rejected"].includes(item.status),
    ).length;
    const inProgress = suiteRequests.filter(
      (item) => item.status === "in_progress",
    ).length;
    const blocked = suiteRequests.filter((item) =>
      ["pending_customer_docs", "waiting_purchase_order"].includes(item.status),
    ).length;
    const unread = partnerNotifications.filter((item) => !item.read).length;

    return {
      pendingReview,
      openQueue,
      inProgress,
      blocked,
      unread,
    };
  }, [suiteRequests, partnerNotifications]);

  const groupedBySuite = useMemo(() => {
    const map = new Map<string, typeof suiteRequests>();
    suiteRequests.forEach((request) => {
      map.set(request.suite, [...(map.get(request.suite) ?? []), request]);
    });
    return map;
  }, [suiteRequests]);

  const severityClass: Record<string, string> = {
    low: "text-slate-200",
    medium: "text-sun",
    high: "text-coral",
    critical: "text-coral",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Partner Dashboard
          </h2>
          <p className="mt-2 text-sm text-slate-200/85">
            Live queue and notification state generated from customer package
            activation.
          </p>
        </div>
        <Badge>{metrics.openQueue} Active Requests</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Pending Review"
          description="Awaiting partner accept/reject."
        >
          <p className="text-3xl font-semibold text-white">
            {metrics.pendingReview}
          </p>
        </Card>
        <Card
          title="In Progress"
          description="Accepted and currently executing."
        >
          <p className="text-3xl font-semibold text-white">
            {metrics.inProgress}
          </p>
        </Card>
        <Card title="Blocked" description="Waiting on customer docs or PO.">
          <p className="text-3xl font-semibold text-amber-300">
            {metrics.blocked}
          </p>
        </Card>
        <Card
          title="Unread Alerts"
          description="Partner notifications not yet viewed."
        >
          <p className="text-3xl font-semibold text-cyan-200">
            {metrics.unread}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Default Provider Model"
          description="Each corporate suite remains mapped to a dedicated provider owner."
        >
          <ul className="space-y-1 text-sm text-slate-100">
            {MOCK_SUITE_OWNERS.map((item) => (
              <li key={item.suite}>
                - {formatSuiteLabel(item.suite)}: {item.owner}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Execution Queue"
          description="Live suite requests grouped by provider."
        >
          <div className="space-y-3">
            {MOCK_SUITE_OWNERS.map((owner) => {
              const queue = groupedBySuite.get(owner.suite) ?? [];
              return (
                <div
                  key={owner.suite}
                  className="rounded-xl border border-white/15 bg-white/5 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {owner.owner} ({formatSuiteLabel(owner.suite)})
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Queue: {queue.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-200">
                    Open:{" "}
                    {
                      queue.filter(
                        (item) =>
                          !["completed", "rejected"].includes(item.status),
                      ).length
                    }
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Alerts" description="Most recent partner notifications.">
          <div className="space-y-3">
            {partnerNotifications.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p
                  className={`text-sm font-semibold ${
                    alert.read ? severityClass.low : severityClass.high
                  }`}
                >
                  {alert.read ? "Read" : "Unread"} notification
                </p>
                <p className="mt-1 text-xs text-slate-300">{alert.message}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {partnerNotifications.length === 0 ? (
              <p className="text-sm text-slate-300">No partner alerts yet.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

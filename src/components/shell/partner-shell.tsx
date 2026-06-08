"use client";

import { useMemo } from "react";
import { useCustomerJourneyStore } from "@/store/customer-journey-store";
import { AppShell } from "@/components/shell/app-shell";
import { partnerNav } from "@/features/navigation/role-nav";

export function PartnerShell({ children }: { children: React.ReactNode }) {
  const suiteRequests = useCustomerJourneyStore((state) => state.suiteRequests);
  const partnerAlerts = useCustomerJourneyStore(
    (state) => state.partnerNotifications,
  );

  const inboxAlertCount = useMemo(
    () =>
      suiteRequests.filter(
        (request) => request.status === "pending_partner_review",
      ).length,
    [suiteRequests],
  );

  const messageAlertCount = useMemo(
    () => partnerAlerts.filter((item) => !item.read).length,
    [partnerAlerts],
  );

  const workOrderAlertCount = useMemo(
    () =>
      suiteRequests.filter(
        (request) =>
          request.partnerDecision === "accepted" &&
          !["completed", "rejected"].includes(request.status),
      ).length,
    [suiteRequests],
  );

  const navItems = useMemo(
    () =>
      partnerNav.map((item) => ({
        ...item,
        badge:
          item.href === "/partner/inbox"
            ? inboxAlertCount
            : item.href === "/partner/messages"
              ? messageAlertCount
              : item.href === "/partner/work-orders"
                ? workOrderAlertCount
                : undefined,
      })),
    [inboxAlertCount, messageAlertCount, workOrderAlertCount],
  );

  return (
    <AppShell roleLabel="Partner" navItems={navItems}>
      {children}
    </AppShell>
  );
}

"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listCustomerRequests } from "@/services/requests.service";
import { useNotificationStore } from "@/store/notification-store";
import { AppShell } from "@/components/shell/app-shell";
import { customerNav } from "@/features/navigation/role-nav";

export function CustomerPortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user } = useAuth();
  const { items: notificationItems } = useNotificationStore();

  const customerRequestsQuery = useQuery({
    queryKey: ["customer-requests", user?.id],
    queryFn: () => listCustomerRequests(user!.id),
    enabled: Boolean(user?.id),
  });

  const requestAlertCount = useMemo(
    () =>
      (customerRequestsQuery.data ?? []).filter(
        (request) => !["completed", "cancelled"].includes(request.status),
      ).length,
    [customerRequestsQuery.data],
  );

  const messageAlertCount = useMemo(
    () => notificationItems.filter((item) => !item.read).length,
    [notificationItems],
  );

  const navItems = useMemo(
    () =>
      customerNav.map((item) => ({
        ...item,
        badge:
          item.href === "/customer/requests"
            ? requestAlertCount
            : item.href === "/customer/messages"
              ? messageAlertCount
              : undefined,
        badgeAlwaysVisible: item.href === "/customer/messages",
      })),
    [requestAlertCount, messageAlertCount],
  );

  return (
    <AppShell roleLabel="Customer" navItems={navItems}>
      {children}
    </AppShell>
  );
}

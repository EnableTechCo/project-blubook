"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetCustomerRequestsQuery } from "@/store/redux/api/customer-api";
import { useListNotificationsQuery } from "@/store/redux/api/notifications-api";
import { AppShell } from "@/components/shell/app-shell";
import { customerNav } from "@/features/navigation/role-nav";

export function CustomerPortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user } = useAuth();
  const notificationsQuery = useListNotificationsQuery(user?.id ?? "", {
    skip: !user?.id,
  });

  const customerRequestsQuery = useGetCustomerRequestsQuery(user?.id ?? "", {
    skip: !user?.id,
  });

  const requestAlertCount = useMemo(
    () =>
      (customerRequestsQuery.data ?? []).filter(
        (request) => !["completed", "cancelled"].includes(request.status),
      ).length,
    [customerRequestsQuery.data],
  );

  const messageAlertCount = useMemo(
    () =>
      (notificationsQuery.data ?? []).filter((item) => item.read_at == null)
        .length,
    [notificationsQuery.data],
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

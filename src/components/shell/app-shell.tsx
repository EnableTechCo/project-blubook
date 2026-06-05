"use client";

import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LayoutGrid, LogOut, Menu, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/services/notifications.service";
import { listCustomerRequests } from "@/services/requests.service";
import { DashboardChatbot } from "@/features/ai/dashboard-chatbot";
import { MOCK_PORTAL_LINKS } from "@/features/mock/dashboard-data";
import { useCustomerJourneyStore } from "@/store/customer-journey-store";
import { useNotificationStore } from "@/store/notification-store";
import { useUiStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

export interface ShellNavItem {
  href: Route;
  label: string;
}

export function AppShell({
  roleLabel,
  navItems,
  children,
}: {
  roleLabel: string;
  navItems: ShellNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, signOut } = useAuth();
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUiStore();
  const { items, setItems, markRead, markAllRead } = useNotificationStore();
  const suiteRequests = useCustomerJourneyStore((state) => state.suiteRequests);
  const viewedSuiteRequestIds = useCustomerJourneyStore(
    (state) => state.viewedSuiteRequestIds,
  );
  const customerAlerts = useCustomerJourneyStore(
    (state) => state.notifications,
  );
  const partnerAlerts = useCustomerJourneyStore(
    (state) => state.partnerNotifications,
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);

  const platformLinks: Array<{ label: string; href: Route }> =
    MOCK_PORTAL_LINKS.map((portal) => ({
      label: portal.label,
      href: portal.href as Route,
    }));

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: Boolean(user?.id),
  });

  const customerRequestsQuery = useQuery({
    queryKey: ["customer-requests", user?.id],
    queryFn: () => listCustomerRequests(user!.id),
    enabled: roleLabel === "Customer" && Boolean(user?.id),
  });

  useEffect(() => {
    if (!notificationsQuery.data) {
      return;
    }

    setItems(
      notificationsQuery.data.map((item) => ({
        id: item.id,
        message: item.message,
        createdAt: item.created_at,
        read: Boolean(item.read_at),
      })),
    );
  }, [notificationsQuery.data, setItems]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    void subscribeToNotifications(user.id, () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", user.id],
      });
    }).then((teardown) => {
      unsubscribe = teardown;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [queryClient, user?.id]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async (_, variables) => {
      markRead(variables.notificationId);
      await queryClient.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      markAllRead();
      await queryClient.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });
    },
  });

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const customerMessageAlertCount = useMemo(
    () =>
      roleLabel === "Customer"
        ? (notificationsQuery.data ?? []).filter((item) => !item.read_at).length
        : customerAlerts.filter(
            (item) => !item.read && item.source !== "system",
          ).length,
    [customerAlerts, notificationsQuery.data, roleLabel],
  );

  const customerRequestAlertCount = useMemo(() => {
    if (roleLabel === "Customer") {
      return (customerRequestsQuery.data ?? []).filter(
        (request) => !["completed", "cancelled"].includes(request.status),
      ).length;
    }

    return suiteRequests.filter(
      (request) =>
        !viewedSuiteRequestIds.includes(request.id) &&
        !["completed", "rejected"].includes(request.status),
    ).length;
  }, [
    customerRequestsQuery.data,
    roleLabel,
    suiteRequests,
    viewedSuiteRequestIds,
  ]);

  const partnerInboxAlertCount = useMemo(
    () =>
      suiteRequests.filter(
        (request) => request.status === "pending_partner_review",
      ).length,
    [suiteRequests],
  );

  const partnerMessageAlertCount = useMemo(
    () => partnerAlerts.filter((item) => !item.read).length,
    [partnerAlerts],
  );

  const partnerWorkOrderAlertCount = useMemo(
    () =>
      suiteRequests.filter(
        (request) =>
          request.partnerDecision === "accepted" &&
          !["completed", "rejected"].includes(request.status),
      ).length,
    [suiteRequests],
  );

  const isNavItemActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* UPDATED: Explicitly clamped layout viewport to h-screen and 
        added a sticky flex-col setup to control content layout distributions cleanly.
      */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-white/10 bg-ink/95 p-5 transition lg:sticky lg:top-0 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Removed px-5 from here to protect original width sizing constraints */}
        <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar pb-4">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                BluBook
              </p>
              <h1 className="text-xl font-semibold text-white">
                {roleLabel} Portal
              </h1>
            </div>
            <button
              className="lg:hidden"
              onClick={closeSidebar}
              aria-label="Close navigation"
            >
              ✕
            </button>
          </div>

          {/* UPDATED: Added px-1 here. This gives the active button rings a tiny bit of breathing room 
              on the sides so they don't look clipped or swallowed by the scrolling edge layout. */}
          <nav className="space-y-2 px-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-100/90 transition hover:bg-white/10",
                  isNavItemActive(item.href)
                    ? "bg-cyan-300/15 text-white ring-1 ring-cyan-200/40"
                    : "",
                )}
              >
                <span>{item.label}</span>
                {roleLabel === "Customer" &&
                item.href === "/customer/requests" &&
                customerRequestAlertCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white">
                    {customerRequestAlertCount > 99
                      ? "99+"
                      : customerRequestAlertCount}
                  </span>
                ) : null}
                {roleLabel === "Customer" &&
                item.href === "/customer/messages" ? (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                      customerMessageAlertCount > 0
                        ? "bg-coral text-white"
                        : "bg-white/10 text-slate-300",
                    )}
                  >
                    {customerMessageAlertCount > 99
                      ? "99+"
                      : customerMessageAlertCount}
                  </span>
                ) : null}
                {roleLabel === "Partner" &&
                item.href === "/partner/inbox" &&
                partnerInboxAlertCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white">
                    {partnerInboxAlertCount > 99 ? "99+" : partnerInboxAlertCount}
                  </span>
                ) : null}
                {roleLabel === "Partner" &&
                item.href === "/partner/messages" &&
                partnerMessageAlertCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white">
                    {partnerMessageAlertCount > 99
                      ? "99+"
                      : partnerMessageAlertCount}
                  </span>
                ) : null}
                {roleLabel === "Partner" &&
                item.href === "/partner/work-orders" &&
                partnerWorkOrderAlertCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold text-white">
                    {partnerWorkOrderAlertCount > 99
                      ? "99+"
                      : partnerWorkOrderAlertCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>

        {/* Restored clean alignment style constraint */}
        <div className="mt-auto border-t border-white/10 pt-4 bg-ink/95">
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-coral/10 hover:text-coral"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              onClick={toggleSidebar}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
              <Search className="h-4 w-4 text-slate-300" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search requests, orders, shipments"
              />
            </div>
            <div className="relative">
              <button
                className="rounded-xl border border-white/20 bg-white/5 p-2"
                aria-label="Switch platform"
                onClick={() => setPlatformOpen((open) => !open)}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>

              {platformOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-white/15 bg-ink/95 p-2 shadow-panel">
                  <p className="px-2 py-1 text-xs uppercase tracking-[0.15em] text-cyan-200/80">
                    Switch Platform
                  </p>
                  <div className="space-y-1">
                    {platformLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setPlatformOpen(false)}
                        className="block rounded-xl px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                      >
                        {item.label} Dashboard
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button
                className="relative rounded-xl border border-white/20 bg-white/5 p-2"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-[320px] rounded-2xl border border-white/15 bg-ink/95 p-3 shadow-panel">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      Notifications
                    </p>
                    <button
                      className="text-xs text-cyan-200 hover:text-white disabled:opacity-60"
                      onClick={() =>
                        user?.id && markAllReadMutation.mutate(user.id)
                      }
                      disabled={
                        markAllReadMutation.isPending || unreadCount === 0
                      }
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {notificationsQuery.isLoading ? (
                      <p className="text-xs text-slate-300">Loading...</p>
                    ) : null}
                    {items.map((item) => (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left transition",
                          item.read
                            ? "border-white/10 bg-white/5"
                            : "border-coral/40 bg-coral/10",
                        )}
                        onClick={() =>
                          user?.id &&
                          markReadMutation.mutate({
                            notificationId: item.id,
                            userId: user.id,
                          })
                        }
                      >
                        <p className="text-sm text-white">{item.message}</p>
                        <p className="mt-1 text-[11px] text-slate-300">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </button>
                    ))}
                    {!notificationsQuery.isLoading && items.length === 0 ? (
                      <p className="text-xs text-slate-300">
                        No notifications yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
        <DashboardChatbot roleLabel={roleLabel} />
      </main>
    </div>
  );
}
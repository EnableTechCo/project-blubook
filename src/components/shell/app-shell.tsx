"use client";

import type { Route } from "next";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLoadingSkeleton } from "@/components/shell/dashboard-loading-skeleton";
import { HoverAnimatedIcon } from "@/components/ui/hover-animated-icon";
import { BellIcon } from "@/components/icons/bell";
import { BoxesIcon } from "@/components/icons/boxes";
import { ChartBarIncreasingIcon } from "@/components/icons/chart-bar-increasing";
import { ChartLineIcon } from "@/components/icons/chart-line";
import { ClipboardCheckIcon } from "@/components/icons/clipboard-check";
import { CreditCardIcon } from "@/components/icons/credit-card";
import { FileCheckIcon } from "@/components/icons/file-check";
import { FilePenLineIcon } from "@/components/icons/file-pen-line";
import { FolderOpenIcon } from "@/components/icons/folder-open";
import { GaugeIcon } from "@/components/icons/gauge";
import { GitMergeIcon } from "@/components/icons/git-merge";
import { HistoryIcon } from "@/components/icons/history";
import { KeyIcon } from "@/components/icons/key";
import { LayoutGridIcon } from "@/components/icons/layout-grid";
import { LogoutIcon } from "@/components/icons/logout";
import { MapPinCheckIcon } from "@/components/icons/map-pin-check";
import { MenuIcon } from "@/components/icons/menu";
import { MessageSquareMoreIcon } from "@/components/icons/message-square-more";
import { MoonIcon } from "@/components/icons/moon";
import { ReceiptIcon } from "@/components/icons/receipt";
import { ReceiptTextIcon } from "@/components/icons/receipt-text";
import { RouteIcon } from "@/components/icons/route";
import { SearchIcon } from "@/components/icons/search";
import { SettingsIcon } from "@/components/icons/settings";
import { ShipIcon } from "@/components/icons/ship";
import { SunIcon } from "@/components/icons/sun";
import { TruckIcon } from "@/components/icons/truck";
import { UserRoundCogIcon } from "@/components/icons/user-round-cog";
import { UsersIcon } from "@/components/icons/users";
import { WorkflowIcon } from "@/components/icons/workflow";
import { SidebarInsightsSlider } from "@/components/shell/sidebar-insights-slider";
import {
  listNotifications,
  subscribeToNotifications,
} from "@/services/notifications.service";
import { useNotificationStore } from "@/store/notification-store";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { useUiStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

export interface ShellNavItem {
  href: Route;
  label: string;
  /** Pre-computed badge count supplied by the role-specific shell wrapper. */
  badge?: number;
  /**
   * When true, the badge is rendered even when the count is 0 (shown in a
   * muted style). Useful for always-visible counters like Messages.
   */
  badgeAlwaysVisible?: boolean;
}

type NavIconProps = {
  className?: string;
  size?: number;
};

type NavIconComponent = ComponentType<NavIconProps>;

const NAV_ICON_BY_HREF: Record<string, NavIconComponent> = {
  "/customer/dashboard": LayoutGridIcon,
  "/customer/billing": CreditCardIcon,
  "/customer/orders": ReceiptTextIcon,
  "/customer/requests": FilePenLineIcon,
  "/customer/messages": MessageSquareMoreIcon,
  "/customer/documents": FolderOpenIcon,
  "/customer/analytics": ChartLineIcon,
  "/customer/settings": SettingsIcon,

  "/partner/dashboard": LayoutGridIcon,
  "/partner/work-orders": WorkflowIcon,
  "/partner/messages": MessageSquareMoreIcon,
  "/partner/documents": FolderOpenIcon,
  "/partner/reports": ChartBarIncreasingIcon,

  "/staff/dashboard": GaugeIcon,
  "/sales/orders": ReceiptIcon,
  "/sales/work-orders": ClipboardCheckIcon,
  "/sales/invoices": FileCheckIcon,
  "/sales/inventory": BoxesIcon,
  "/logistics/shipments": TruckIcon,
  "/logistics/tracking": RouteIcon,
  "/logistics/carriers": ShipIcon,
  "/logistics/delivery": MapPinCheckIcon,

  "/admin/dashboard": LayoutGridIcon,
  "/admin/users": UsersIcon,
  "/admin/roles": KeyIcon,
  "/admin/settings": SettingsIcon,
  "/admin/audit-logs": HistoryIcon,
  "/admin/workflows": GitMergeIcon,
};

function getNavIcon(item: ShellNavItem): NavIconComponent {
  return NAV_ICON_BY_HREF[item.href.toString()] ?? LayoutGridIcon;
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
  const { data: user, isLoading: authLoading, signOut } = useAuth();
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUiStore();
  const { items, setItems } = useNotificationStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hoveredNavHref, setHoveredNavHref] = useState<string | null>(null);
  const [hoveredProfileAction, setHoveredProfileAction] = useState<
    string | null
  >(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: Boolean(user?.id),
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

    const unsubscribe = subscribeToNotifications(user.id, () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", user.id],
      });
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, user?.id]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const isNavItemActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const isDark = theme === "dark";

  const settingsHref = useMemo(() => {
    const existingSettingsRoute = navItems.find((item) =>
      item.href.endsWith("/settings"),
    )?.href;

    if (existingSettingsRoute) {
      return existingSettingsRoute;
    }

    const rootSegment = pathname.split("/").filter(Boolean)[0];
    if (!rootSegment) {
      return "/settings" as Route;
    }

    return `/${rootSegment}/settings` as Route;
  }, [navItems, pathname]);

  const userDisplayName =
    (typeof user?.user_metadata?.name === "string" &&
      user.user_metadata.name.trim()) ||
    (typeof user?.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    user?.email ||
    "Signed in";

  const userEmail =
    typeof user?.email === "string" && user.email.length > 0
      ? user.email
      : "No email on file";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");

    // Keep light as the startup baseline by clearing stale persisted theme.
    if (theme === "light") {
      window.localStorage.removeItem("blubook-theme");
    }
  }, [theme]);

  useEffect(() => {
    setProfileMenuOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col p-5 transition lg:sticky lg:top-0 lg:translate-x-0",
          isDark
            ? "border-r border-slate-700 bg-slate-900/95 text-slate-100"
            : "border-r border-slate-200 bg-white/95 text-slate-900",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full min-h-0 flex-col pb-4">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p
                className={cn(
                  "text-xs uppercase tracking-[0.2em]",
                  isDark ? "text-cyan-300/85" : "text-cyan-700/85",
                )}
              >
                BluBook
              </p>
              <h1
                className={cn(
                  "text-xl font-semibold",
                  isDark ? "text-slate-100" : "text-slate-900",
                )}
              >
                {roleLabel} Portal
              </h1>
            </div>
            <button
              type="button"
              className="lg:hidden"
              onClick={closeSidebar}
              aria-label="Close navigation"
            >
              ✕
            </button>
          </div>

          <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 no-scrollbar">
            {navItems.map((item) => {
              const showBadge =
                item.badgeAlwaysVisible ||
                (item.badge != null && item.badge > 0);
              const badgeCount = item.badge ?? 0;
              const NavIcon = getNavIcon(item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setHoveredNavHref(item.href)}
                  onMouseLeave={() =>
                    setHoveredNavHref((current) =>
                      current === item.href ? null : current,
                    )
                  }
                  className={cn(
                    "group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                    isDark
                      ? "text-slate-200 hover:bg-slate-800"
                      : "text-slate-700 hover:bg-slate-100",
                    isNavItemActive(item.href)
                      ? isDark
                        ? "bg-cyan-900/45 text-cyan-100 ring-1 ring-cyan-700"
                        : "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-300/60"
                      : "",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <HoverAnimatedIcon
                      icon={NavIcon}
                      active={hoveredNavHref === item.href}
                      className={cn(
                        "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                        isNavItemActive(item.href)
                          ? isDark
                            ? "text-cyan-200"
                            : "text-cyan-700"
                          : isDark
                            ? "text-slate-300 group-hover:text-cyan-200"
                            : "text-slate-500 group-hover:text-cyan-700",
                      )}
                      size={16}
                    />
                    <span>{item.label}</span>
                  </span>
                  {showBadge ? (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                        badgeCount > 0
                          ? "bg-coral text-white"
                          : isDark
                            ? "bg-slate-800 text-slate-300"
                            : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0 space-y-3 pt-4">
            <SidebarInsightsSlider isDark={isDark} />

            <div className="relative mb-2">
              <button
                type="button"
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  isDark
                    ? "border-slate-700 bg-slate-800 hover:border-slate-600 hover:bg-slate-700"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                )}
                onClick={() => setProfileMenuOpen((current) => !current)}
                aria-expanded={profileMenuOpen}
                aria-label="Open profile and settings"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-cyan-900/50 text-cyan-200"
                      : "bg-cyan-100 text-cyan-800",
                  )}
                >
                  {userDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs font-semibold",
                      isDark ? "text-slate-100" : "text-slate-800",
                    )}
                    title={userDisplayName}
                  >
                    {userDisplayName}
                  </p>
                  <p
                    className={cn(
                      "truncate text-[11px]",
                      isDark ? "text-slate-400" : "text-slate-500",
                    )}
                    title={userEmail}
                  >
                    {userEmail}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isDark
                      ? "text-slate-400 group-hover:text-slate-200"
                      : "text-slate-500 group-hover:text-slate-700",
                    profileMenuOpen ? "rotate-90" : "rotate-0",
                  )}
                />
              </button>

              {profileMenuOpen ? (
                <div
                  className={cn(
                    "absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border p-2 shadow-panel",
                    isDark
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <Link
                    href={settingsHref}
                    onMouseEnter={() => setHoveredProfileAction("settings")}
                    onMouseLeave={() =>
                      setHoveredProfileAction((current) =>
                        current === "settings" ? null : current,
                      )
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition",
                      isDark
                        ? "text-slate-200 hover:bg-slate-800"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <HoverAnimatedIcon
                      icon={UserRoundCogIcon}
                      active={hoveredProfileAction === "settings"}
                      className="h-3 w-3 shrink-0"
                      size={12}
                    />
                    <span className="leading-none">Profile & Settings</span>
                  </Link>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredProfileAction("theme")}
                    onMouseLeave={() =>
                      setHoveredProfileAction((current) =>
                        current === "theme" ? null : current,
                      )
                    }
                    className={cn(
                      "mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition",
                      isDark
                        ? "text-slate-200 hover:bg-slate-800"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                    onClick={() =>
                      setTheme((current) =>
                        current === "dark" ? "light" : "dark",
                      )
                    }
                  >
                    {theme === "dark" ? (
                      <HoverAnimatedIcon
                        icon={SunIcon}
                        active={hoveredProfileAction === "theme"}
                        className="h-3 w-3 shrink-0"
                        size={12}
                      />
                    ) : (
                      <HoverAnimatedIcon
                        icon={MoonIcon}
                        active={hoveredProfileAction === "theme"}
                        className="h-3 w-3 shrink-0"
                        size={12}
                      />
                    )}
                    <span className="leading-none">
                      Switch to {theme === "dark" ? "Light" : "Dark"} Mode
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onMouseEnter={() => setHoveredProfileAction("signout")}
              onMouseLeave={() =>
                setHoveredProfileAction((current) =>
                  current === "signout" ? null : current,
                )
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-coral/10 hover:text-coral disabled:cursor-not-allowed disabled:opacity-60",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isSigningOut}
              aria-label="Sign out"
            >
              <HoverAnimatedIcon
                icon={LogoutIcon}
                active={hoveredProfileAction === "signout"}
                className="h-4 w-4"
                size={16}
              />
              <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <header
          className={cn(
            "sticky top-0 z-40 border-b px-4 py-3 backdrop-blur lg:px-8",
            isDark
              ? "border-slate-700 bg-slate-900/85"
              : "border-slate-200 bg-white/90",
          )}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onMouseEnter={() => setHoveredProfileAction("menu")}
              onMouseLeave={() =>
                setHoveredProfileAction((current) =>
                  current === "menu" ? null : current,
                )
              }
              className="lg:hidden"
              onClick={toggleSidebar}
              aria-label="Open navigation"
            >
              <HoverAnimatedIcon
                icon={MenuIcon}
                active={hoveredProfileAction === "menu"}
                className="h-5 w-5"
                size={18}
              />
            </button>
            <div
              className={cn(
                "flex flex-1 items-center gap-2 rounded-xl border px-3 py-2",
                isDark
                  ? "border-slate-700 bg-slate-800"
                  : "border-slate-300 bg-slate-50",
              )}
            >
              <HoverAnimatedIcon
                icon={SearchIcon}
                active={hoveredProfileAction === "search"}
                className={cn(
                  "h-4 w-4",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
                size={16}
              />
              <input
                onMouseEnter={() => setHoveredProfileAction("search")}
                onMouseLeave={() =>
                  setHoveredProfileAction((current) =>
                    current === "search" ? null : current,
                  )
                }
                className={cn(
                  "w-full bg-transparent text-sm outline-none",
                  isDark
                    ? "text-slate-100 placeholder:text-slate-400"
                    : "text-slate-800 placeholder:text-slate-500",
                )}
                placeholder="Search requests, orders, shipments"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setHoveredProfileAction("bell")}
                onMouseLeave={() =>
                  setHoveredProfileAction((current) =>
                    current === "bell" ? null : current,
                  )
                }
                className={cn(
                  "relative rounded-xl border p-2",
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-200"
                    : "border-slate-300 bg-slate-50 text-slate-700",
                )}
                aria-label="Notifications"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <HoverAnimatedIcon
                  icon={BellIcon}
                  active={hoveredProfileAction === "bell"}
                  className="h-4 w-4"
                  size={16}
                />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen && user?.id ? (
                <NotificationPanel
                  userId={user.id}
                  isDark={isDark}
                  isLoading={notificationsQuery.isLoading}
                />
              ) : null}
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8">
          {authLoading ? <DashboardLoadingSkeleton /> : children}
        </div>
      </main>
    </div>
  );
}

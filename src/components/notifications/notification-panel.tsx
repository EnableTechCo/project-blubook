"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsRead,
} from "@/services/notifications.service";
import { useNotificationStore } from "@/store/notification-store";
import {
  buildNotificationEntries,
  type GroupEntry,
  type SingleEntry,
} from "@/features/notifications/notification-classifier";
import { cn } from "@/lib/utils";

interface NotificationPanelProps {
  userId: string;
  isDark: boolean;
  isLoading: boolean;
}

// ── Single item ───────────────────────────────────────────────────────────────

function SingleNotificationCard({
  entry,
  userId,
  isDark,
}: {
  entry: SingleEntry;
  userId: string;
  isDark: boolean;
}) {
  const { markRead } = useNotificationStore();
  const queryClient = useQueryClient();

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async (_, vars) => {
      markRead(vars.notificationId);
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  const isHigh = entry.priority === "high";

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-xl border px-3 py-2.5 text-left transition",
        entry.item.read
          ? isDark
            ? "border-slate-700 bg-slate-800/60"
            : "border-slate-200 bg-slate-50"
          : isHigh
            ? "border-coral/50 bg-coral/10 ring-1 ring-coral/20"
            : isDark
              ? "border-slate-600 bg-slate-800"
              : "border-slate-300 bg-white",
      )}
      onClick={() =>
        !entry.item.read &&
        markReadMutation.mutate({
          notificationId: entry.item.id,
          userId,
        })
      }
    >
      <div className="flex items-start gap-2">
        {isHigh && !entry.item.read ? (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm leading-snug",
              isHigh && !entry.item.read
                ? isDark
                  ? "font-medium text-white"
                  : "font-medium text-slate-900"
                : isDark
                  ? "text-slate-200"
                  : "text-slate-700",
            )}
          >
            {entry.item.message}
          </p>
          <p
            className={cn(
              "mt-1 text-[11px]",
              isDark ? "text-slate-500" : "text-slate-400",
            )}
          >
            {new Date(entry.item.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Group item ────────────────────────────────────────────────────────────────

function GroupNotificationCard({
  entry,
  userId,
  isDark,
}: {
  entry: GroupEntry;
  userId: string;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { markGroupRead, markRead } = useNotificationStore();
  const queryClient = useQueryClient();

  const markGroupMutation = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: async (_, vars) => {
      markGroupRead(vars.notificationIds);
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async (_, vars) => {
      markRead(vars.notificationId);
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  const hasUnread = entry.unreadCount > 0;

  return (
    <div
      className={cn(
        "rounded-xl border",
        isDark ? "border-slate-700" : "border-slate-200",
      )}
    >
      {/* Group header */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2.5",
          isDark ? "bg-slate-800/70" : "bg-slate-50",
          expanded
            ? isDark
              ? "rounded-t-xl border-b border-slate-700"
              : "rounded-t-xl border-b border-slate-200"
            : "rounded-xl",
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          {hasUnread ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-500/30 px-1.5 text-[11px] font-semibold text-slate-300">
              {entry.unreadCount}
            </span>
          ) : null}
          <span
            className={cn(
              "truncate text-sm font-medium",
              isDark ? "text-slate-200" : "text-slate-700",
            )}
          >
            {entry.label}
          </span>
          <span
            className={cn(
              "shrink-0 text-[11px]",
              isDark ? "text-slate-500" : "text-slate-400",
            )}
          >
            {entry.items.length}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {hasUnread ? (
            <button
              type="button"
              className={cn(
                "text-[11px] transition disabled:opacity-50",
                isDark
                  ? "text-cyan-400 hover:text-cyan-300"
                  : "text-cyan-700 hover:text-cyan-800",
              )}
              disabled={markGroupMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                markGroupMutation.mutate({
                  notificationIds: entry.ids,
                  userId,
                });
              }}
            >
              Mark read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse group" : "Expand group"}
            className={cn(
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded items */}
      {expanded ? (
        <div
          className={cn(
            "divide-y rounded-b-xl",
            isDark ? "divide-slate-700" : "divide-slate-100",
          )}
        >
          {entry.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "w-full px-3 py-2.5 text-left transition last:rounded-b-xl",
                item.read
                  ? isDark
                    ? "bg-slate-800/40"
                    : "bg-white"
                  : isDark
                    ? "bg-slate-800"
                    : "bg-slate-50",
              )}
              onClick={() =>
                !item.read &&
                markOneMutation.mutate({
                  notificationId: item.id,
                  userId,
                })
              }
            >
              <div className="flex items-start gap-2">
                {!item.read ? (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                ) : (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                )}
                <div>
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    {item.message}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px]",
                      isDark ? "text-slate-500" : "text-slate-400",
                    )}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function NotificationPanel({
  userId,
  isDark,
  isLoading,
}: NotificationPanelProps) {
  const { items, markAllRead } = useNotificationStore();
  const queryClient = useQueryClient();

  const entries = useMemo(() => buildNotificationEntries(items), [items]);

  const unreadCount = useMemo(
    () => items.filter((i) => !i.read).length,
    [items],
  );

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      markAllRead();
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  return (
    <div
      className={cn(
        "absolute right-0 z-50 mt-2 w-[340px] rounded-2xl border p-3 shadow-panel",
        isDark
          ? "border-slate-700 bg-slate-900"
          : "border-slate-200 bg-white",
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p
          className={cn(
            "text-sm font-semibold",
            isDark ? "text-slate-100" : "text-slate-900",
          )}
        >
          Notifications
          {unreadCount > 0 ? (
            <span
              className={cn(
                "ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                isDark
                  ? "bg-coral/80 text-white"
                  : "bg-coral text-white",
              )}
            >
              {unreadCount}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          className={cn(
            "text-xs disabled:opacity-50",
            isDark
              ? "text-cyan-400 hover:text-cyan-300"
              : "text-cyan-700 hover:text-cyan-800",
          )}
          onClick={() => markAllMutation.mutate(userId)}
          disabled={markAllMutation.isPending || unreadCount === 0}
        >
          Mark all read
        </button>
      </div>

      {/* List */}
      <div className="max-h-[400px] space-y-2 overflow-y-auto">
        {isLoading ? (
          <p
            className={cn(
              "text-xs",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Loading...
          </p>
        ) : entries.length === 0 ? (
          <p
            className={cn(
              "text-xs",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            No notifications yet.
          </p>
        ) : (
          entries.map((entry) =>
            entry.type === "single" ? (
              <SingleNotificationCard
                key={entry.item.id}
                entry={entry}
                userId={userId}
                isDark={isDark}
              />
            ) : (
              <GroupNotificationCard
                key={entry.key}
                entry={entry}
                userId={userId}
                isDark={isDark}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

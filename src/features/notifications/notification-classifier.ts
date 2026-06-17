import type { NotificationItem } from "@/store/notification-store";

// ── Priority classification ───────────────────────────────────────────────────
// Anything matching these patterns requires user attention and is rendered
// individually at the top of the panel.

const HIGH_PRIORITY_PATTERNS: RegExp[] = [
  /action required/i,
  /requires? your/i,
  /payment/i,
  /rejected/i,
  /failed/i,
  /approved/i,
  /accepted/i,
  /declined/i,
  /overdue/i,
  /urgent/i,
  /invoice/i,
  /purchase order/i,
  /dispute/i,
  /compliance/i,
  /please sign/i,
  /attention/i,
];

export type NotificationPriority = "high" | "low";

export function classifyPriority(message: string): NotificationPriority {
  return HIGH_PRIORITY_PATTERNS.some((p) => p.test(message)) ? "high" : "low";
}

// ── Group key derivation ──────────────────────────────────────────────────────
// Low-priority notifications are bucketed by topic so similar alerts collapse.

function deriveGroupKey(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("order")) return "order";
  if (m.includes("shipment") || m.includes("delivery") || m.includes("logistics")) return "shipment";
  if (m.includes("document") || m.includes("upload") || m.includes("file")) return "document";
  if (m.includes("workflow") || m.includes("step")) return "workflow";
  if (m.includes("status")) return "status";
  if (m.includes("message")) return "message";
  return "general";
}

const GROUP_LABELS: Record<string, string> = {
  order:    "Order updates",
  shipment: "Shipment & delivery updates",
  document: "Document activity",
  workflow: "Workflow updates",
  status:   "Status updates",
  message:  "Message notifications",
  general:  "General notifications",
};

// ── Display entry types ───────────────────────────────────────────────────────

export interface SingleEntry {
  type: "single";
  priority: NotificationPriority;
  item: NotificationItem;
}

export interface GroupEntry {
  type: "group";
  key: string;
  label: string;
  items: NotificationItem[];
  unreadCount: number;
  ids: string[];
}

export type NotificationEntry = SingleEntry | GroupEntry;

// ── Builder ───────────────────────────────────────────────────────────────────
// Produces a display list: high-priority singles first (newest first), then
// low-priority groups (most unread first). Low-priority items that are alone in
// their bucket are shown as muted singles rather than single-item groups.

export function buildNotificationEntries(
  items: NotificationItem[],
): NotificationEntry[] {
  const highSingles: SingleEntry[] = [];
  const lowSingles: SingleEntry[] = [];
  const lowByKey = new Map<string, NotificationItem[]>();

  for (const item of items) {
    const priority = classifyPriority(item.message);
    if (priority === "high") {
      highSingles.push({ type: "single", priority: "high", item });
    } else {
      const key = deriveGroupKey(item.message);
      const bucket = lowByKey.get(key) ?? [];
      bucket.push(item);
      lowByKey.set(key, bucket);
    }
  }

  const groups: GroupEntry[] = [];

  for (const [key, bucket] of lowByKey.entries()) {
    if (bucket.length < 2) {
      // Lone low-priority item — treat as a muted single.
      lowSingles.push({ type: "single", priority: "low", item: bucket[0]! });
    } else {
      groups.push({
        type: "group",
        key,
        label: GROUP_LABELS[key] ?? "Notifications",
        items: bucket,
        unreadCount: bucket.filter((i) => !i.read).length,
        ids: bucket.map((i) => i.id),
      });
    }
  }

  // Sort high-priority by recency, groups by unread count desc.
  highSingles.sort(
    (a, b) =>
      new Date(b.item.createdAt).getTime() -
      new Date(a.item.createdAt).getTime(),
  );
  lowSingles.sort(
    (a, b) =>
      new Date(b.item.createdAt).getTime() -
      new Date(a.item.createdAt).getTime(),
  );
  groups.sort((a, b) => b.unreadCount - a.unreadCount);

  return [...highSingles, ...groups, ...lowSingles];
}

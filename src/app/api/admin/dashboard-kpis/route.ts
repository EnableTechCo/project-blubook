import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminAuth = {
  admin: ReturnType<typeof createAdminClient>;
};

type KpiCard = {
  id: string;
  title: string;
  value: number;
  unit: "count" | "percent";
  trendDeltaPct: number;
  trendDirection: "up" | "down" | "flat";
  formula: string;
  drillDownHref: string;
  drillDownLabel: string;
};

type SalesOrderRow = {
  status: string | null;
  created_at: string | null;
};

type QueueRow = {
  status: string | null;
  created_at: string | null;
};

type HandoffRow = {
  status: string | null;
  assigned_at: string | null;
};

async function requireAdminOrStaff(): Promise<
  AdminAuth | { error: NextResponse }
> {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

function toMs(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function inWindow(
  value: string | null,
  startInclusiveMs: number,
  endExclusiveMs: number,
) {
  const time = toMs(value);
  return time !== null && time >= startInclusiveMs && time < endExclusiveMs;
}

function isCompletedStatus(status: string | null) {
  const normalized = (status ?? "").toLowerCase();
  return normalized.includes("delivered") || normalized.includes("complete");
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function deltaPct(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function trendDirection(delta: number): "up" | "down" | "flat" {
  if (delta > 0.01) return "up";
  if (delta < -0.01) return "down";
  return "flat";
}

export async function GET() {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const last7Start = nowMs - 7 * dayMs;
    const prev7Start = nowMs - 14 * dayMs;
    const staleThreshold = nowMs - dayMs;

    const [ordersResult, queueResult, handoffsResult] = await Promise.all([
      auth.admin.from("sales_orders").select("status, created_at").limit(2000),
      auth.admin
        .from("workflow_events_queue")
        .select("status, created_at")
        .limit(2000),
      auth.admin
        .from("provider_workflow_handoffs")
        .select("status, assigned_at")
        .limit(2000),
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (queueResult.error) throw queueResult.error;
    if (handoffsResult.error) throw handoffsResult.error;

    const orders = (ordersResult.data ?? []) as SalesOrderRow[];
    const queue = (queueResult.data ?? []) as QueueRow[];
    const handoffs = (handoffsResult.data ?? []) as HandoffRow[];

    const completedLast7 = orders.filter(
      (row) =>
        isCompletedStatus(row.status) &&
        inWindow(row.created_at, last7Start, nowMs),
    ).length;
    const completedPrev7 = orders.filter(
      (row) =>
        isCompletedStatus(row.status) &&
        inWindow(row.created_at, prev7Start, last7Start),
    ).length;

    const totalLast7 = orders.filter((row) =>
      inWindow(row.created_at, last7Start, nowMs),
    ).length;
    const totalPrev7 = orders.filter((row) =>
      inWindow(row.created_at, prev7Start, last7Start),
    ).length;

    const deliveryRateLast7 = pct(completedLast7, totalLast7);
    const deliveryRatePrev7 = pct(completedPrev7, totalPrev7);

    const queueTotalLast7 = queue.filter((row) =>
      inWindow(row.created_at, last7Start, nowMs),
    ).length;
    const queueFailedLast7 = queue.filter(
      (row) =>
        (row.status ?? "").toLowerCase() === "failed" &&
        inWindow(row.created_at, last7Start, nowMs),
    ).length;

    const queueTotalPrev7 = queue.filter((row) =>
      inWindow(row.created_at, prev7Start, last7Start),
    ).length;
    const queueFailedPrev7 = queue.filter(
      (row) =>
        (row.status ?? "").toLowerCase() === "failed" &&
        inWindow(row.created_at, prev7Start, last7Start),
    ).length;

    const queueHealthLast7 = pct(
      Math.max(0, queueTotalLast7 - queueFailedLast7),
      queueTotalLast7,
    );
    const queueHealthPrev7 = pct(
      Math.max(0, queueTotalPrev7 - queueFailedPrev7),
      queueTotalPrev7,
    );

    const activeHandoffsLast7 = handoffs.filter(
      (row) =>
        (row.status ?? "").toLowerCase() !== "completed" &&
        inWindow(row.assigned_at, last7Start, nowMs),
    ).length;
    const staleHandoffsLast7 = handoffs.filter((row) => {
      const assigned = toMs(row.assigned_at);
      return (
        (row.status ?? "").toLowerCase() !== "completed" &&
        assigned !== null &&
        assigned >= last7Start &&
        assigned < nowMs &&
        assigned < staleThreshold
      );
    }).length;

    const activeHandoffsPrev7 = handoffs.filter(
      (row) =>
        (row.status ?? "").toLowerCase() !== "completed" &&
        inWindow(row.assigned_at, prev7Start, last7Start),
    ).length;
    const staleHandoffsPrev7 = handoffs.filter((row) => {
      const assigned = toMs(row.assigned_at);
      const prevStaleThreshold = last7Start - dayMs;
      return (
        (row.status ?? "").toLowerCase() !== "completed" &&
        assigned !== null &&
        assigned >= prev7Start &&
        assigned < last7Start &&
        assigned < prevStaleThreshold
      );
    }).length;

    const staleRateLast7 = pct(staleHandoffsLast7, activeHandoffsLast7);
    const staleRatePrev7 = pct(staleHandoffsPrev7, activeHandoffsPrev7);

    const cards: KpiCard[] = [
      {
        id: "order-throughput",
        title: "Order Throughput (7d)",
        value: completedLast7,
        unit: "count",
        trendDeltaPct: deltaPct(completedLast7, completedPrev7),
        trendDirection: trendDirection(
          deltaPct(completedLast7, completedPrev7),
        ),
        formula:
          "Orders completed in the last 7 days compared to the prior 7-day period.",
        drillDownHref: "/admin/orders?view=completed",
        drillDownLabel: "Open Completed Orders",
      },
      {
        id: "delivery-success-rate",
        title: "Delivery Success Rate (7d)",
        value: deliveryRateLast7,
        unit: "percent",
        trendDeltaPct: deltaPct(deliveryRateLast7, deliveryRatePrev7),
        trendDirection: trendDirection(
          deltaPct(deliveryRateLast7, deliveryRatePrev7),
        ),
        formula:
          "Percentage of orders placed in the last 7 days that were successfully delivered.",
        drillDownHref: "/admin/orders?view=completed",
        drillDownLabel: "Review Delivered Orders",
      },
      {
        id: "queue-health-rate",
        title: "Queue Health Rate (7d)",
        value: queueHealthLast7,
        unit: "percent",
        trendDeltaPct: deltaPct(queueHealthLast7, queueHealthPrev7),
        trendDirection: trendDirection(
          deltaPct(queueHealthLast7, queueHealthPrev7),
        ),
        formula:
          "Proportion of dispatch queue events that processed without failure in the last 7 days.",
        drillDownHref: "/admin/dispatch-queue?status=failed",
        drillDownLabel: "Inspect Failed Queue Events",
      },
      {
        id: "stale-handoff-rate",
        title: "Stale Handoff Rate (7d)",
        value: staleRateLast7,
        unit: "percent",
        trendDeltaPct: deltaPct(staleRateLast7, staleRatePrev7),
        trendDirection: trendDirection(
          deltaPct(staleRateLast7, staleRatePrev7),
        ),
        formula:
          "Share of active logistics handoffs that have been open longer than 24 hours without progress.",
        drillDownHref: "/admin/logistics-handoffs?stale=1",
        drillDownLabel: "Review Stale Handoffs",
      },
    ];

    return NextResponse.json({
      window: {
        from: new Date(last7Start).toISOString(),
        to: new Date(nowMs).toISOString(),
      },
      cards,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load admin KPI cards.",
      },
      { status: 500 },
    );
  }
}

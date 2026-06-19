import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdminOrStaff() {
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

async function countBy(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  value: string,
) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function isCompletedStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes("delivered") || normalized.includes("complete");
}

export async function GET() {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const staleThreshold = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      ordersResult,
      activePartners,
      activeCustomers,
      queueFailed,
      queueQueued,
      staleHandoffs,
    ] = await Promise.all([
      auth.admin.from("sales_orders").select("status"),
      countBy(auth.admin, "organizations", "kind", "partner"),
      countBy(auth.admin, "organizations", "kind", "customer"),
      countBy(auth.admin, "workflow_events_queue", "status", "failed"),
      countBy(auth.admin, "workflow_events_queue", "status", "queued"),
      auth.admin
        .from("provider_workflow_handoffs")
        .select("id", { count: "exact", head: true })
        .neq("status", "completed")
        .lt("assigned_at", staleThreshold)
        .then(({ count, error }) => {
          if (error) {
            throw error;
          }
          return count ?? 0;
        }),
    ]);

    if (ordersResult.error) {
      throw ordersResult.error;
    }

    const completedOrders = (ordersResult.data ?? []).filter((row) =>
      isCompletedStatus(row.status ?? ""),
    ).length;
    const activeOrders = Math.max(
      0,
      (ordersResult.data ?? []).length - completedOrders,
    );

    const alerts: string[] = [];

    if (queueFailed > 0) {
      alerts.push(
        `${queueFailed} failed workflow queue events require attention.`,
      );
    }

    if (staleHandoffs > 0) {
      alerts.push(`${staleHandoffs} handoffs are stale for more than 24h.`);
    }

    if (activeOrders > 0 && completedOrders === 0) {
      alerts.push("No delivered orders found in the current metrics window.");
    }

    return NextResponse.json({
      metrics: {
        activeOrders,
        completedOrders,
        activePartners,
        activeCustomers,
        queueFailed,
        queueQueued,
        staleHandoffs,
      },
      alerts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load admin overview metrics.",
      },
      { status: 500 },
    );
  }
}

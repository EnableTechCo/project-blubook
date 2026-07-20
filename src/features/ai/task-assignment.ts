import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskType = "pick_ticket" | "work_order";

export interface StaffOwnerOption {
  userId: string;
  name: string;
  openTaskCount: number;
}

export interface TaskAssignmentRecommendation {
  taskId: string;
  taskType: TaskType;
  orderReference: string;
  productName: string;
  urgencyHours: number;
  primary: StaffOwnerOption;
  backups: StaffOwnerOption[];
  reason: string;
}

// ─── Detection ────────────────────────────────────────────────────────────────

// TODO: replace this function body with a real LLM API call.
// Expected interface:
//   POST /api/ai/tasks/recommend-assignment
//   body: { tasks: { taskId, taskType, urgencyHours }[], staffWorkloads: { userId, openTaskCount }[] }
//   response: { recommendations: TaskAssignmentRecommendation[] }

// Only the "staff" role is eligible for fulfillment task ownership. "admin"
// is an oversight role, not an execution team, and is intentionally excluded
// — this is the role boundary the acceptance criteria asks for.
const ELIGIBLE_ROLE = "staff";

interface RawTaskRow {
  id: string;
  created_at: string;
  order_item_id: string;
}

async function loadEligibleStaff(
  admin: SupabaseClient,
): Promise<Map<string, { name: string }>> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id, full_name, email")
    .eq("role", ELIGIBLE_ROLE)
    .eq("membership_status", "active");

  if (error) throw new Error(error.message);

  const staff = new Map<string, { name: string }>();
  for (const row of data ?? []) {
    staff.set(row.user_id as string, {
      name: (row.full_name as string | null) ?? (row.email as string),
    });
  }
  return staff;
}

async function loadOpenWorkloadByAssignee(
  admin: SupabaseClient,
): Promise<Map<string, number>> {
  const workload = new Map<string, number>();

  const [pickTickets, workOrders] = await Promise.all([
    admin
      .from("pick_tickets")
      .select("assigned_to")
      .eq("status", "pending")
      .not("assigned_to", "is", null),
    admin
      .from("work_orders")
      .select("assigned_to")
      .eq("status", "pending")
      .not("assigned_to", "is", null),
  ]);

  if (pickTickets.error) throw new Error(pickTickets.error.message);
  if (workOrders.error) throw new Error(workOrders.error.message);

  for (const row of [...(pickTickets.data ?? []), ...(workOrders.data ?? [])]) {
    const id = row.assigned_to as string;
    workload.set(id, (workload.get(id) ?? 0) + 1);
  }

  return workload;
}

function rankOwners(
  staff: Map<string, { name: string }>,
  workload: Map<string, number>,
): StaffOwnerOption[] {
  return [...staff.entries()]
    .map(([userId, info]) => ({
      userId,
      name: info.name,
      openTaskCount: workload.get(userId) ?? 0,
    }))
    .sort((a, b) => {
      const diff = a.openTaskCount - b.openTaskCount;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
}

function reasonFor(
  taskType: TaskType,
  urgencyHours: number,
  primary: StaffOwnerOption,
  backups: StaffOwnerOption[],
): string {
  const taskLabel = taskType === "pick_ticket" ? "pick ticket" : "work order";
  const loadPhrase =
    primary.openTaskCount === 0
      ? "no open tasks"
      : `${primary.openTaskCount} open task${primary.openTaskCount === 1 ? "" : "s"}`;

  const comparison =
    backups.length > 0
      ? ` — the next-lowest option, ${backups[0].name}, currently has ${backups[0].openTaskCount} open task${backups[0].openTaskCount === 1 ? "" : "s"}.`
      : ".";

  return `${primary.name} has ${loadPhrase}, the lowest active load on the team — assigning here keeps work balanced${comparison} This ${taskLabel} has been waiting ${Math.round(urgencyHours)}h.`;
}

interface OrderContextRow {
  id: string;
  product_name: string;
  order_id: string;
  po_reference: string | null;
}

async function loadOrderContext(
  admin: SupabaseClient,
  orderItemIds: string[],
): Promise<Map<string, { productName: string; orderReference: string }>> {
  const context = new Map<string, { productName: string; orderReference: string }>();
  if (orderItemIds.length === 0) return context;

  const { data: items, error } = await admin
    .from("sales_order_items")
    .select("id, product_name, order_id")
    .in("id", orderItemIds);

  if (error) throw new Error(error.message);

  const orderIds = [...new Set((items ?? []).map((i) => i.order_id as string))];
  const { data: orders, error: ordersError } = await admin
    .from("sales_orders")
    .select("id, po_reference")
    .in("id", orderIds);

  if (ordersError) throw new Error(ordersError.message);

  const poByOrderId = new Map<string, string>();
  for (const order of orders ?? []) {
    poByOrderId.set(order.id as string, (order.po_reference as string | null) ?? order.id as string);
  }

  for (const item of items ?? []) {
    context.set(item.id as string, {
      productName: item.product_name as string,
      orderReference: poByOrderId.get(item.order_id as string) ?? (item.order_id as string),
    });
  }

  return context;
}

export async function detectTaskAssignmentRecommendations(
  admin: SupabaseClient,
): Promise<TaskAssignmentRecommendation[]> {
  const [staff, workload] = await Promise.all([
    loadEligibleStaff(admin),
    loadOpenWorkloadByAssignee(admin),
  ]);

  const [pickTicketsRes, workOrdersRes] = await Promise.all([
    admin
      .from("pick_tickets")
      .select("id, created_at, order_item_id")
      .eq("status", "pending")
      .is("assigned_to", null)
      .limit(100),
    admin
      .from("work_orders")
      .select("id, created_at, order_item_id")
      .eq("status", "pending")
      .is("assigned_to", null)
      .limit(100),
  ]);

  if (pickTicketsRes.error) throw new Error(pickTicketsRes.error.message);
  if (workOrdersRes.error) throw new Error(workOrdersRes.error.message);

  const unassignedTasks: Array<{ taskType: TaskType; row: RawTaskRow }> = [
    ...(pickTicketsRes.data ?? []).map((row) => ({
      taskType: "pick_ticket" as const,
      row: row as RawTaskRow,
    })),
    ...(workOrdersRes.data ?? []).map((row) => ({
      taskType: "work_order" as const,
      row: row as RawTaskRow,
    })),
  ];

  const orderContext = await loadOrderContext(
    admin,
    unassignedTasks.map((t) => t.row.order_item_id),
  );

  const owners = rankOwners(staff, workload);

  const recommendations: TaskAssignmentRecommendation[] = [];

  for (const { taskType, row } of unassignedTasks) {
    if (owners.length === 0) {
      // No eligible staff to recommend — nothing to suggest for this task.
      continue;
    }

    const urgencyHours = (Date.now() - new Date(row.created_at).getTime()) / 3_600_000;
    const [primary, ...backups] = owners;
    const context = orderContext.get(row.order_item_id);

    recommendations.push({
      taskId: row.id,
      taskType,
      orderReference: context?.orderReference ?? row.order_item_id,
      productName: context?.productName ?? "Unknown item",
      urgencyHours: Math.round(urgencyHours * 10) / 10,
      primary,
      backups: backups.slice(0, 2),
      reason: reasonFor(taskType, urgencyHours, primary, backups),
    });
  }

  recommendations.sort((a, b) => b.urgencyHours - a.urgencyHours);

  return recommendations;
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export async function assignTask(
  admin: SupabaseClient,
  taskId: string,
  taskType: TaskType,
  ownerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (profileError) return { ok: false, error: profileError.message };
  if (!profile || profile.role !== ELIGIBLE_ROLE) {
    return { ok: false, error: "Selected owner is not an eligible staff member." };
  }

  const table = taskType === "pick_ticket" ? "pick_tickets" : "work_orders";

  const { error } = await admin
    .from(table)
    .update({ assigned_to: ownerId, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("status", "pending")
    .is("assigned_to", null);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

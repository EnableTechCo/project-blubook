import type { SupabaseClient } from "@supabase/supabase-js";

export interface StockItem {
  sku: string;
  quantity: number;
}

export async function getStockLevel(
  sku: string,
  admin: SupabaseClient,
): Promise<number> {
  const { data, error } = await admin
    .from("inventory_movements")
    .select("quantity")
    .eq("sku", sku);

  if (error) throw new Error(error.message);

  return (data ?? []).reduce(
    (sum, row) => sum + (row.quantity as number),
    0,
  );
}

// Calls the atomic DB function that locks SKU rows, checks availability,
// and inserts the deduction — all in one transaction to prevent races.
export async function reserveStockForOrder(
  orderId: string,
  items: StockItem[],
  actorId: string,
  admin: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const item of items) {
    const { error } = await admin.rpc("reserve_inventory_for_order", {
      p_sku: item.sku,
      p_quantity: item.quantity,
      p_order_id: orderId,
      p_actor_id: actorId,
    });

    if (error) {
      const message = error.message.includes("Insufficient stock")
        ? error.message
        : `Could not reserve stock for SKU "${item.sku}": ${error.message}`;
      return { ok: false, error: message };
    }
  }

  return { ok: true };
}

// Inserts a restoration movement for every reservation tied to this order,
// effectively reversing the deduction when a reservation is rolled back.
export async function restoreStockForOrder(
  orderId: string,
  actorId: string,
  admin: SupabaseClient,
): Promise<void> {
  const { data: reservations, error } = await admin
    .from("inventory_movements")
    .select("sku, quantity")
    .eq("sales_order_id", orderId)
    .eq("movement_type", "reservation");

  if (error) throw new Error(error.message);

  for (const row of reservations ?? []) {
    await admin.from("inventory_movements").insert({
      sku: row.sku as string,
      quantity: Math.abs(row.quantity as number),
      movement_type: "restoration" as const,
      sales_order_id: orderId,
      actor_id: actorId,
      reason: "Inventory reservation reverted",
    });
  }
}

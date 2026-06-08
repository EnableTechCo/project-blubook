"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type WorkOrder = {
  id: string;
  status: "pending" | "manufacturing" | "completed";
  quantity_to_build: number;
  created_at: string;
  sales_order_items: {
    product_name: string;
    sku: string;
    sales_orders: {
      po_reference: string | null;
    } | null;
  } | null;
};

export function SalesWorkOrdersClient() {
  const supabase = useMemo(() => createClient(), []);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchWorkOrders = useEffectEvent(async () => {
    try {
      // Fetch all work orders with parent relation details
      const { data, error } = await supabase
        .from("work_orders")
        .select(
          `
          id,
          status,
          quantity_to_build,
          created_at,
          sales_order_items (
            product_name,
            sku,
            sales_orders (
              po_reference
            )
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching work orders:", error);
      } else {
        setWorkOrders((data as unknown as WorkOrder[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void fetchWorkOrders();
  }, [fetchWorkOrders]);

  async function handleStartWork(woId: string) {
    setProcessing(true);
    try {
      // 1. Queue task.started event
      const { error: queueError } = await supabase
        .from("workflow_events_queue")
        .insert({
          event_type: "task.started",
          payload: { taskId: woId, taskType: "work_order" },
          status: "queued",
        });

      if (queueError) throw new Error(queueError.message);

      // 2. Auto trigger queue dispatch for instant feedback
      await triggerQueueDispatch();
      showMsg("success", "Manufacturing task started successfully.");
    } catch (err) {
      showMsg(
        "error",
        err instanceof Error ? err.message : "Failed to start task.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleCompleteWork(woId: string) {
    setProcessing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Queue task.completed event
      const { error: queueError } = await supabase
        .from("workflow_events_queue")
        .insert({
          event_type: "task.completed",
          payload: {
            taskId: woId,
            taskType: "work_order",
            userId: user?.id || null,
          },
          status: "queued",
        });

      if (queueError) throw new Error(queueError.message);

      // 2. Auto trigger queue dispatch for instant feedback
      await triggerQueueDispatch();
      showMsg("success", "Manufacturing task completed successfully.");
    } catch (err) {
      showMsg(
        "error",
        err instanceof Error ? err.message : "Failed to complete task.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function triggerQueueDispatch() {
    const response = await fetch("/api/system/workflow/dispatch", {
      method: "POST",
    });
    if (response.ok) {
      await fetchWorkOrders();
    }
  }

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-300">
        Loading work orders...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-2xl border text-sm transition-all ${
            message.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card
        title="Active Production Queue"
        description="Manage shopfloor operations and record progress."
      >
        {workOrders.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">
            No work orders in queue. Create orders via the Sales Orders
            dashboard to seed work orders.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3">PO Reference</th>
                  <th className="py-3">Product Name</th>
                  <th className="py-3 font-mono">SKU</th>
                  <th className="py-3 text-center">Quantity</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => {
                  const product = wo.sales_order_items;
                  const poRef =
                    product?.sales_orders?.po_reference || "No PO Ref";

                  return (
                    <tr
                      key={wo.id}
                      className="border-b border-white/5 text-slate-200 hover:bg-white/5"
                    >
                      <td className="py-4 font-semibold text-white">{poRef}</td>
                      <td className="py-4">
                        {product?.product_name || "Unknown Product"}
                      </td>
                      <td className="py-4 font-mono">
                        {product?.sku || "N/A"}
                      </td>
                      <td className="py-4 text-center font-semibold">
                        {wo.quantity_to_build}
                      </td>
                      <td className="py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] uppercase ${
                            wo.status === "pending"
                              ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
                              : wo.status === "manufacturing"
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                                : "bg-green-500/10 border-green-500/20 text-green-300"
                          }`}
                        >
                          {wo.status}
                        </span>
                      </td>
                      <td className="py-4 text-right space-x-2">
                        {wo.status === "pending" && (
                          <Button
                            variant="ghost"
                            disabled={processing}
                            onClick={() => handleStartWork(wo.id)}
                            className="h-8 text-xs border-blue-400/30 hover:bg-blue-500/15 hover:text-blue-300"
                          >
                            Start Production
                          </Button>
                        )}
                        {wo.status === "manufacturing" && (
                          <Button
                            disabled={processing}
                            onClick={() => handleCompleteWork(wo.id)}
                            className="h-8 text-xs bg-green-600 hover:bg-green-500 text-white"
                          >
                            Mark Completed
                          </Button>
                        )}
                        {wo.status === "completed" && (
                          <span className="text-xs text-slate-400 italic">
                            Task Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

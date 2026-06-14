"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkflowStepMatrix } from "@/components/ui/workflow-progress";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { LOGISTICS_WORKFLOW_STATES } from "@/constants/logistics-workflow-states";

type LogisticsOrder = {
  id: string;
  status: string;
  po_reference: string | null;
  updated_at: string;
  metadata?: {
    workflow_timeline?: Array<{ step?: string }>;
  } | null;
};

export function LogisticsShipmentsClient() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<LogisticsOrder | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const stepEventsQuery = useQuery({
    queryKey: ["step-events", selectedOrder?.id],
    enabled: Boolean(selectedOrder?.id),
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(
        `/api/orders/${selectedOrder!.id}/step-events?audience=logistics`,
        { credentials: "include" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) return [];
      return (body?.completedStepKeys ?? []) as string[];
    },
  });
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [docChecklistByOrder, setDocChecklistByOrder] = useState<
    Record<string, { shippingLabel: boolean; podUploaded: boolean }>
  >({});

  const fetchOrders = useCallback(async () => {
    const response = await fetch("/api/system/workflow/orders", {
      method: "GET",
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      showMsg("error", body?.error ?? "Could not load logistics shipments.");
      return;
    }

    const nextOrders = (body?.orders ?? []) as LogisticsOrder[];
    setOrders(nextOrders);

    if (!selectedOrder && nextOrders.length > 0) {
      setSelectedOrder(nextOrders[0]);
      return;
    }

    if (selectedOrder) {
      const matched = nextOrders.find((item) => item.id === selectedOrder.id);
      setSelectedOrder(matched ?? null);
    }
  }, [selectedOrder]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        await fetchOrders();
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [fetchOrders]);

  async function dispatchQueue() {
    const response = await fetch("/api/system/workflow/dispatch", {
      method: "POST",
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error ?? "Could not run workflow dispatch.");
    }

    if (typeof body?.failed === "number" && body.failed > 0) {
      throw new Error(
        `Workflow dispatch completed with ${body.failed} failed event(s).`,
      );
    }
  }

  async function queueEvent(eventType: string, successMessage: string) {
    if (!selectedOrder) {
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.from("workflow_events_queue").insert({
        event_type: eventType,
        payload: { orderId: selectedOrder.id },
        status: "queued",
      });

      if (error) {
        throw new Error(error.message);
      }

      await dispatchQueue();
      await fetchOrders();
      showMsg("success", successMessage);
    } catch (error) {
      showMsg(
        "error",
        error instanceof Error
          ? error.message
          : "Could not continue logistics workflow.",
      );
    } finally {
      setProcessing(false);
    }
  }

  function toggleDoc(
    orderId: string,
    key: "shippingLabel" | "podUploaded",
    checked: boolean,
  ) {
    setDocChecklistByOrder((current) => ({
      ...current,
      [orderId]: {
        shippingLabel: current[orderId]?.shippingLabel ?? false,
        podUploaded: current[orderId]?.podUploaded ?? false,
        [key]: checked,
      },
    }));
  }

  async function handleInTransit() {
    if (!selectedOrder) {
      return;
    }

    const docs = docChecklistByOrder[selectedOrder.id] ?? {
      shippingLabel: false,
      podUploaded: false,
    };

    if (!docs.shippingLabel) {
      showMsg(
        "error",
        "Shipping label/documentation must be uploaded before transit starts.",
      );
      return;
    }

    await queueEvent(
      "order.shipped",
      "Transit started. Workflow notifications were triggered.",
    );
  }

  function stepEnabled(requiredStatus: string) {
    return selectedOrder?.status === requiredStatus;
  }

  async function handleDelivered() {
    if (!selectedOrder) {
      return;
    }

    const docs = docChecklistByOrder[selectedOrder.id] ?? {
      shippingLabel: false,
      podUploaded: false,
    };

    if (!docs.podUploaded) {
      showMsg(
        "error",
        "Proof of delivery must be uploaded before delivery close-out.",
      );
      return;
    }

    await queueEvent(
      "order.delivered",
      "Delivery completed and customer notification dispatched.",
    );
  }

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-300">Loading logistics shipments...</p>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-1">
        <Card
          title="Shipment Queue"
          description="Orders currently flowing through logistics execution."
        >
          {orders.length === 0 ? (
            <p className="py-8 text-sm text-slate-300">
              No active shipments found.
            </p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedOrder?.id === order.id
                      ? "border-cyan-300/40 bg-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">
                    {order.po_reference ?? order.id}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-300">
                    {order.status}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4 xl:col-span-2">
        {message ? (
          <div
            className={`rounded-xl border p-3 text-sm ${
              message.type === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-400/30 bg-red-500/10 text-red-200"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {selectedOrder ? (
          <>
            <WorkflowPipeline
              title={`Logistics Lifecycle: ${selectedOrder.po_reference ?? selectedOrder.id}`}
              states={LOGISTICS_WORKFLOW_STATES}
              currentState={selectedOrder.status}
            />

            <WorkflowStepMatrix
              completedStepKeys={stepEventsQuery.data ?? []}
              audience="logistics"
              title="Logistics Workflow Steps"
            />

            <Card
              title="Logistics Control Points"
              description="Sequential action gates — each button advances the order to the next logistics state."
            >
              <div className="space-y-3">
                {/* Stage 1 — Intake */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 1 — Intake
                  </p>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={processing || !stepEnabled("Shipment Created")}
                    onClick={() =>
                      queueEvent(
                        "logistics.order_received",
                        "Order intake acknowledged by logistics.",
                      )
                    }
                  >
                    Acknowledge Intake
                  </Button>
                  {!stepEnabled("Shipment Created") &&
                  selectedOrder?.status !== "Order Received" ? (
                    <p className="mt-1 text-[11px] text-amber-300">
                      Requires: Shipment Created by Sales
                    </p>
                  ) : null}
                </div>

                {/* Stage 2 — Warehouse */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 2 — Warehouse Transmission
                  </p>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={processing || !stepEnabled("Order Received")}
                    onClick={() =>
                      queueEvent(
                        "logistics.warehouse_transmitted",
                        "Order transmitted to warehouse.",
                      )
                    }
                  >
                    Transmit to Warehouse
                  </Button>
                </div>

                {/* Stage 3 — Customer Notification */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 3 — Customer Notification
                  </p>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={
                      processing ||
                      !stepEnabled("Order Transmitted to Warehouse")
                    }
                    onClick={() =>
                      queueEvent(
                        "logistics.customer_notified",
                        "Customer notified of incoming shipment.",
                      )
                    }
                  >
                    Notify Customer
                  </Button>
                </div>

                {/* Stage 4 — Packing */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 4 — Packing
                  </p>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={processing || !stepEnabled("Notify Customer")}
                    onClick={() =>
                      queueEvent(
                        "logistics.items_packed",
                        "Items confirmed packed for shipment.",
                      )
                    }
                  >
                    Confirm Items Packed
                  </Button>
                </div>

                {/* Stage 5 — Shipping Label */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 5 — Shipping Label & Documentation
                  </p>
                  <div className="mt-3 space-y-2 text-xs text-slate-200">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={
                          docChecklistByOrder[selectedOrder.id]
                            ?.shippingLabel ?? false
                        }
                        onChange={(event) =>
                          toggleDoc(
                            selectedOrder.id,
                            "shippingLabel",
                            event.target.checked,
                          )
                        }
                      />
                      Shipping label and compliance docs uploaded
                    </label>
                  </div>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={
                      processing || !stepEnabled("Pack Items for Shipment")
                    }
                    onClick={() =>
                      queueEvent(
                        "logistics.shipping_label_generated",
                        "Shipping label and documentation generated.",
                      )
                    }
                  >
                    Generate Shipping Label
                  </Button>
                </div>

                {/* Stage 6 — In Transit */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 6 — In Transit
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Requires shipping label to be uploaded (Stage 5 checkbox).
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-3 h-8 border-cyan-400/30 text-xs hover:bg-cyan-500/10 hover:text-cyan-200"
                    disabled={
                      processing ||
                      !stepEnabled("Generate Shipping Label & Documentation")
                    }
                    onClick={handleInTransit}
                  >
                    Move To In Transit
                  </Button>
                </div>

                {/* Stage 6b — Reroute (exception path) */}
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
                    Stage 6b — Reroute Delivery (Exception)
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Use if a delivery issue occurs while in transit. After
                    resolving, resume transit with &ldquo;Resume In
                    Transit&rdquo;.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="ghost"
                      className="h-8 border-amber-400/30 text-xs hover:bg-amber-500/10 hover:text-amber-200"
                      disabled={
                        processing || !stepEnabled("Track Shipment In Transit")
                      }
                      onClick={() =>
                        queueEvent(
                          "logistics.reroute_delivery",
                          "Delivery issue flagged — order routed for exception handling.",
                        )
                      }
                    >
                      Flag Delivery Issue
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 border-cyan-400/30 text-xs hover:bg-cyan-500/10 hover:text-cyan-200"
                      disabled={processing || !stepEnabled("Reroute Delivery")}
                      onClick={() =>
                        queueEvent(
                          "logistics.reroute_complete",
                          "Reroute resolved — order returned to in-transit tracking.",
                        )
                      }
                    >
                      Resume In Transit
                    </Button>
                  </div>
                </div>

                {/* Stage 7 — Arrival */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 7 — Order Arrives at Destination
                  </p>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={
                      processing || !stepEnabled("Track Shipment In Transit")
                    }
                    onClick={() =>
                      queueEvent(
                        "logistics.order_arrived",
                        "Order arrival at destination confirmed.",
                      )
                    }
                  >
                    Confirm Arrival
                  </Button>
                </div>

                {/* Stage 8 — POD */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 8 — Customer Signs POD
                  </p>
                  <div className="mt-3 space-y-2 text-xs text-slate-200">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={
                          docChecklistByOrder[selectedOrder.id]?.podUploaded ??
                          false
                        }
                        onChange={(event) =>
                          toggleDoc(
                            selectedOrder.id,
                            "podUploaded",
                            event.target.checked,
                          )
                        }
                      />
                      POD uploaded and signed by customer
                    </label>
                  </div>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={
                      processing || !stepEnabled("Order Arrives at Destination")
                    }
                    onClick={() =>
                      queueEvent(
                        "logistics.pod_signed",
                        "Customer POD recorded.",
                      )
                    }
                  >
                    Record POD Signed
                  </Button>
                </div>

                {/* Stage 9 — System Update */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 9 — BluBook System Update
                  </p>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={
                      processing ||
                      !stepEnabled("Customer Receives & Signs POD")
                    }
                    onClick={() =>
                      queueEvent(
                        "logistics.system_updated",
                        "BluBook system status updated.",
                      )
                    }
                  >
                    Update System
                  </Button>
                </div>

                {/* Stage 10 — Delivery Close-Out */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Stage 10 — Delivery Close-Out
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Requires POD to be uploaded (Stage 8 checkbox).
                  </p>
                  <Button
                    className="mt-3 h-8 text-xs"
                    disabled={
                      processing || !stepEnabled("BluBook System Updated")
                    }
                    onClick={handleDelivered}
                  >
                    Confirm Delivery
                  </Button>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card
            title="No shipment selected"
            description="Select an order from the queue to manage logistics stages."
          >
            <p className="text-sm text-slate-300">
              Waiting for order selection.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

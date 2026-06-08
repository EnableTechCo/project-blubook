"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { SALES_WORKFLOW_STATES } from "@/constants/sales-workflow-states";

type OrderItem = {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
  fulfillment_route: "pick" | "produce" | "order";
};

type SalesOrder = {
  id: string;
  status: string;
  total_cents: number;
  currency_code: string;
  po_reference: string | null;
  created_at: string;
  items?: OrderItem[];
  partnerHandoffs?: PartnerHandoff[];
};

type PartnerHandoff = {
  id: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "rejected";
  package_stream: string;
  metadata?: {
    provider_name?: string;
  } | null;
};

type GuidedStepStatus =
  | "pending"
  | "active"
  | "done"
  | "needs-action"
  | "error";

const GUIDED_STEPS = [
  {
    title: "Resolve authenticated organization",
    hint: "Validates your user context and org mapping before testing.",
  },
  {
    title: "Generate demo PO and run engine",
    hint: "Creates a sales order, line items, queue event, and dispatches workflow.",
  },
  {
    title: "Verify order exists in queue",
    hint: "Confirms the newly generated order is persisted.",
  },
  {
    title: "Partner action required",
    hint: "A partner must accept, start, and complete the outsourced item before the test can continue.",
  },
  {
    title: "Review final order details",
    hint: "Confirm the order now shows completed partner handoff data, then finish the guided test.",
  },
] as const;

export function SalesOrdersClient() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [poRef, setPoRef] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [guidedStatuses, setGuidedStatuses] = useState<GuidedStepStatus[]>(
    GUIDED_STEPS.map(() => "pending"),
  );
  const [guidedActive, setGuidedActive] = useState(false);
  const [guidedActionStep, setGuidedActionStep] = useState<number | null>(null);
  const [guidedError, setGuidedError] = useState<string | null>(null);
  const [guidedOrderId, setGuidedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (guidedActionStep !== 3 || !guidedOrderId) {
      return;
    }

    let active = true;
    const poll = async () => {
      const response = await fetch(
        `/api/system/workflow/orders?orderId=${encodeURIComponent(guidedOrderId)}`,
      );
      const payload = await response.json();

      if (!active || !response.ok || !payload?.order) {
        return;
      }

      const refreshedOrder = {
        ...payload.order,
        items: payload.items ?? [],
        partnerHandoffs: payload.partnerHandoffs ?? [],
      } as SalesOrder;

      setSelectedOrder(refreshedOrder);

      const partnerHandoffs = (payload.partnerHandoffs ??
        []) as PartnerHandoff[];
      if (
        partnerHandoffs.length > 0 &&
        partnerHandoffs.every((handoff) => handoff.status === "completed")
      ) {
        updateGuidedStep(3, "done");
        updateGuidedStep(4, "needs-action");
        setGuidedActionStep(4);
        showMsg(
          "success",
          "Partner completion detected. Review the final order details, then finish the guided test.",
        );
        return;
      }

      window.setTimeout(poll, 3000);
    };

    void poll();

    return () => {
      active = false;
    };
  }, [guidedActionStep, guidedOrderId]);

  const log = (step: string, details?: unknown) => {
    if (details === undefined) {
      console.log(`[SalesWorkflow] ${step}`);
      return;
    }
    console.log(`[SalesWorkflow] ${step}`, details);
  };

  const fetchOrders = useEffectEvent(async (organizationId: string) => {
    log("fetchOrders:start", { organizationId });
    const response = await fetch("/api/system/workflow/orders", {
      method: "GET",
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error("Error fetching orders:", payload);
      log("fetchOrders:error", payload);
      return;
    }

    const ordersData = payload?.orders as SalesOrder[] | undefined;

    log("fetchOrders:success", {
      count: ordersData?.length ?? 0,
      latestOrderId: ordersData?.[0]?.id ?? null,
    });

    setOrders(ordersData || []);
    if (ordersData && ordersData.length > 0) {
      // If we already have a selected order, update it, otherwise select the first one
      const currentSelected = selectedOrder
        ? ordersData.find((o) => o.id === selectedOrder.id)
        : null;
      await selectOrderDetails(currentSelected || ordersData[0]);
    } else {
      setSelectedOrder(null);
    }
  });

  const selectOrderDetails = useEffectEvent(async (order: SalesOrder) => {
    log("selectOrderDetails:start", {
      orderId: order.id,
      poReference: order.po_reference,
    });
    const response = await fetch(
      `/api/system/workflow/orders?orderId=${encodeURIComponent(order.id)}`,
      {
        method: "GET",
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      console.error("Error fetching order items:", payload);
      log("selectOrderDetails:error", payload);
      return;
    }

    const itemsData = payload?.items as OrderItem[] | undefined;
    const partnerHandoffs = payload?.partnerHandoffs as
      | PartnerHandoff[]
      | undefined;

    log("selectOrderDetails:success", {
      orderId: order.id,
      itemCount: itemsData?.length ?? 0,
    });

    setSelectedOrder({
      ...order,
      items: (itemsData as OrderItem[]) || [],
      partnerHandoffs: partnerHandoffs || [],
    });
  });

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        log("loadData:start");
        const {
          data: { user },
        } = await supabase.auth.getUser();
        log("auth:getUser", {
          hasUser: Boolean(user),
          userId: user?.id ?? null,
          email: user?.email ?? null,
        });
        if (!user) {
          showMsg(
            "error",
            "You are not signed in. Login as staff/admin to run the engine.",
          );
          log("loadData:blocked:notAuthenticated");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          log("profile:organizationLookup:error", profileError);
        }

        log("profile:organizationLookup", {
          userId: user.id,
          organizationId: profile?.organization_id ?? null,
        });

        let organizationId = profile?.organization_id ?? null;

        if (!organizationId) {
          const { data: membership, error: membershipError } = await supabase
            .from("organization_memberships")
            .select("organization_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (membershipError) {
            log("membership:organizationLookup:error", membershipError);
          }

          organizationId = membership?.organization_id ?? null;
          log("membership:organizationLookup", {
            userId: user.id,
            organizationId,
          });
        }

        if (!organizationId) {
          log("serverContext:organizationLookup:start", { userId: user.id });
          const response = await fetch("/api/auth/context", { method: "GET" });
          if (response.ok) {
            const context = await response.json();
            organizationId = context?.organizationId ?? null;
            log("serverContext:organizationLookup", {
              userId: context?.userId ?? user.id,
              organizationId,
              role: context?.role ?? null,
            });
          } else {
            let errorBody: unknown = null;
            try {
              errorBody = await response.json();
            } catch {
              errorBody = null;
            }
            log("serverContext:organizationLookup:error", {
              status: response.status,
              body: errorBody,
            });
          }
        }

        if (!organizationId) {
          showMsg(
            "error",
            "No organization mapping found for this user. Ensure user_profiles or organization_memberships has your user_id.",
          );
          log("loadData:blocked:noOrganization");
          return;
        }

        setOrgId(organizationId);
        await fetchOrders(organizationId);
      } catch (err) {
        console.error("Failed to load data:", err);
        log("loadData:error", err);
      } finally {
        log("loadData:complete");
        setLoading(false);
      }
    }

    void loadData();
  }, [fetchOrders, supabase]);

  function updateGuidedStep(index: number, status: GuidedStepStatus) {
    setGuidedStatuses((current) =>
      current.map((value, i) => (i === index ? status : value)),
    );
  }

  function activateGuidedStep(index: number) {
    setGuidedStatuses((current) =>
      current.map((value, i) => {
        if (i < index && value !== "done") return "done";
        if (i === index) return "active";
        return value;
      }),
    );
  }

  function resetGuidedTest() {
    setGuidedStatuses(GUIDED_STEPS.map(() => "pending"));
    setGuidedActive(false);
    setGuidedActionStep(null);
    setGuidedError(null);
    setGuidedOrderId(null);
  }

  // Create a Demo Sales Order with 3 items representing the 3 paths (Pick, Produce, Order)
  async function createDemoOrderAndRunEngine() {
    log("generateDemoOrder:clicked", {
      orgId,
      poRefInput: poRef,
    });
    if (!orgId) {
      showMsg("error", "No active organization found for your user profile.");
      log("generateDemoOrder:blocked:noOrg");
      return null;
    }

    setProcessing(true);
    let createdOrderId: string | null = null;
    try {
      const demoRef =
        poRef.trim() || `PO-DEMO-${Date.now().toString().slice(-6)}`;
      log("generateDemoOrder:prepare", {
        demoRef,
        mode: "server-endpoint",
      });

      const response = await fetch("/api/system/workflow/demo-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ poReference: demoRef }),
      });

      const result = await response.json();
      log("generateDemoOrder:serverResult", {
        status: response.status,
        ok: response.ok,
        result,
      });

      if (!response.ok) {
        throw new Error(
          result?.error || "Failed to create demo order via server.",
        );
      }

      createdOrderId = result?.orderId ?? null;
      if (!createdOrderId) {
        throw new Error("Server response did not include orderId.");
      }

      showMsg(
        "success",
        `Demo order ${result?.poReference || demoRef} created. Engine processed ${result?.dispatch?.processed ?? 0} event(s).`,
      );
      log("generateDemoOrder:success", {
        demoRef: result?.poReference || demoRef,
        orderId: createdOrderId,
        queuedEventId: result?.queuedEventId ?? null,
        dispatch: result?.dispatch ?? null,
      });
      setPoRef("");
      await fetchOrders(orgId);

      return createdOrderId;
    } catch (err) {
      log("generateDemoOrder:error", err);
      showMsg(
        "error",
        err instanceof Error ? err.message : "Fulfillment trigger failed",
      );
      return null;
    } finally {
      log("generateDemoOrder:complete");
      setProcessing(false);
    }
  }

  async function handleCreateDemoOrder() {
    await createDemoOrderAndRunEngine();
  }

  async function startGuidedWorkflowTest() {
    if (processing) return;

    resetGuidedTest();
    setGuidedActive(true);

    try {
      activateGuidedStep(0);
      if (!orgId) {
        throw new Error("No active organization found for the signed-in user.");
      }
      updateGuidedStep(0, "done");

      activateGuidedStep(1);
      const createdOrderId = await createDemoOrderAndRunEngine();
      if (!createdOrderId) {
        throw new Error("Failed to generate demo order and run engine.");
      }
      setGuidedOrderId(createdOrderId);
      updateGuidedStep(1, "done");

      activateGuidedStep(2);
      const verifyResponse = await fetch(
        `/api/system/workflow/orders?orderId=${encodeURIComponent(createdOrderId)}`,
        {
          method: "GET",
        },
      );
      const verifyPayload = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyPayload?.order?.id) {
        throw new Error(
          verifyPayload?.error ||
            "Generated order could not be verified in sales queue.",
        );
      }
      updateGuidedStep(2, "done");

      updateGuidedStep(3, "needs-action");
      setGuidedActionStep(3);
      showMsg(
        "success",
        "Guided test paused for partner action. Complete the assigned partner work order in a partner session.",
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Guided workflow test failed.";
      setGuidedError(msg);
      showMsg("error", msg);
      if (guidedActionStep === null) {
        const firstActive = guidedStatuses.findIndex((s) => s === "active");
        if (firstActive >= 0) {
          updateGuidedStep(firstActive, "error");
        }
      }
      setGuidedActive(false);
    }
  }

  function continueGuidedInteraction() {
    if (guidedActionStep === 4) {
      updateGuidedStep(4, "done");
      setGuidedActionStep(null);
      setGuidedActive(false);
      showMsg(
        "success",
        `Guided workflow test completed${guidedOrderId ? ` for order ${guidedOrderId}.` : "."}`,
      );
    }
  }

  // Trigger dispatch queue processing via API
  async function triggerQueueDispatch() {
    log("dispatch:start");
    setProcessing(true);
    try {
      const response = await fetch("/api/system/workflow/dispatch", {
        method: "POST",
      });
      log("dispatch:httpResponse", {
        ok: response.ok,
        status: response.status,
      });
      const result = await response.json();
      log("dispatch:payload", result);
      if (response.ok) {
        showMsg(
          "success",
          `Workflow processed. Events: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`,
        );
        if (orgId) {
          await fetchOrders(orgId);
        }
      } else {
        showMsg("error", result.error || "System queue run failed.");
      }
    } catch (err) {
      log("dispatch:error", err);
      showMsg("error", "Failed to communicate with system dispatch route.");
    } finally {
      log("dispatch:complete");
      setProcessing(false);
    }
  }

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  const formatPrice = (cents: number) => {
    return `R${(cents / 100).toFixed(2)}`;
  };

  const guidedDoneCount = guidedStatuses.filter(
    (status) => status === "done",
  ).length;
  const guidedProgressPercent = Math.round(
    (guidedDoneCount / GUIDED_STEPS.length) * 100,
  );

  const statusTone: Record<GuidedStepStatus, string> = {
    pending: "bg-slate-800/80 text-slate-300 border-slate-600/50",
    active: "bg-cyan-500/15 text-cyan-200 border-cyan-400/40",
    done: "bg-green-500/15 text-green-200 border-green-400/40",
    "needs-action": "bg-amber-500/15 text-amber-200 border-amber-400/40",
    error: "bg-red-500/15 text-red-200 border-red-400/40",
  };

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-300">
        Loading sales orders dashboard...
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      {/* Sidebar - Create & List Orders */}
      <div className="xl:col-span-1 space-y-6">
        <Card
          title="Guided Workflow Test"
          description="Step-by-step test runner with automatic progress and manual interaction checkpoints."
        >
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                <span>Progress</span>
                <span>
                  {guidedDoneCount}/{GUIDED_STEPS.length} complete
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${guidedProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {GUIDED_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className={`rounded-xl border p-2 ${statusTone[guidedStatuses[index]]}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold">
                      {index + 1}. {step.title}
                    </p>
                    <span className="text-[10px] uppercase tracking-wide">
                      {guidedStatuses[index]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] opacity-90">{step.hint}</p>
                </div>
              ))}
            </div>

            {guidedActionStep === 3 ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                <p>
                  Action required: sign in as the partner test user in another
                  session, open Partner Work Orders, then Accept, Start Work,
                  and Mark Complete for the assigned outsourced item.
                </p>
                <p className="mt-2">
                  Partner test login: partner.workflow.test@mock.blubook.local /
                  DBPass123!
                </p>
                <a
                  href="/partner/work-orders"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex font-semibold text-cyan-200 underline"
                >
                  Open Partner Work Orders
                </a>
              </div>
            ) : null}

            {guidedActionStep === 4 ? (
              <div className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                <p>
                  Action required: confirm the final order details on the right,
                  then click Continue to finish the guided test.
                </p>
              </div>
            ) : null}

            {guidedError ? (
              <p className="text-xs text-red-300">
                Guided test error: {guidedError}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={processing || guidedActive}
                onClick={startGuidedWorkflowTest}
              >
                Start Guided Test
              </Button>
              <Button
                variant="ghost"
                className="flex-1 border-coral/30 hover:bg-coral/10 hover:text-coral"
                disabled={guidedActionStep === null || guidedActionStep === 3}
                onClick={continueGuidedInteraction}
              >
                Continue
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full border-white/20"
              disabled={processing}
              onClick={resetGuidedTest}
            >
              Reset Guided Test
            </Button>
          </div>
        </Card>

        {/* Create Order Panel */}
        <Card
          title="Mock Order Generator"
          description="Generate an order containing Pick, Produce, and Order paths."
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Purchase Order Reference
              </label>
              <input
                type="text"
                value={poRef}
                onChange={(e) => setPoRef(e.target.value)}
                placeholder="e.g., PO-84920"
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-coral transition"
              />
            </div>
            <Button
              className="w-full"
              disabled={processing}
              onClick={handleCreateDemoOrder}
            >
              {processing ? "Processing..." : "Generate Demo PO & Run Engine"}
            </Button>
          </div>
        </Card>

        {/* System Queue Panel */}
        <Card
          title="System Workflow Orchestrator"
          description="Manually execute background queue processing."
        >
          <Button
            variant="ghost"
            className="w-full border-coral/30 hover:bg-coral/10 hover:text-coral"
            disabled={processing}
            onClick={triggerQueueDispatch}
          >
            {processing ? "Processing..." : "Execute Workflow Engine Queue"}
          </Button>
        </Card>

        {/* Order List */}
        <Card
          title="Sales Orders Queue"
          description="Historical list of active database-driven orders."
        >
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No orders created yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => selectOrderDetails(o)}
                  className={`w-full text-left p-3 rounded-xl transition border ${
                    selectedOrder?.id === o.id
                      ? "bg-white/10 border-coral"
                      : "bg-white/5 border-white/10 hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">
                      {o.po_reference || "No Reference"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-300">
                      {formatPrice(o.total_cents)}
                    </span>
                    <span className="text-[10px] bg-slate-800 text-cyan-200 px-2 py-0.5 rounded-full border border-cyan-400/20">
                      {o.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Main Panel - Selected Order & Details */}
      <div className="xl:col-span-2 space-y-6">
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

        {selectedOrder ? (
          <div className="space-y-6">
            {/* Workflow Timeline Display */}
            <WorkflowPipeline
              title={`Fulfillment Pipeline: ${selectedOrder.po_reference}`}
              states={SALES_WORKFLOW_STATES}
              currentState={selectedOrder.status}
            />

            {/* Order Details Card */}
            <Card
              title={`Order Details: ${selectedOrder.po_reference}`}
              description={`System ID: ${selectedOrder.id}`}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-b border-white/10">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Status
                  </span>
                  <span className="text-sm font-semibold text-cyan-200">
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Amount
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {formatPrice(selectedOrder.total_cents)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Currency
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {selectedOrder.currency_code}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Created At
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-3">
                  Line Items Sourcing Routes
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2">Product</th>
                        <th className="py-2">SKU</th>
                        <th className="py-2">Fulfillment Route</th>
                        <th className="py-2 text-center">Qty</th>
                        <th className="py-2 text-right">Price</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-white/5 text-slate-200 hover:bg-white/5"
                        >
                          <td className="py-3 font-semibold text-white">
                            {item.product_name}
                          </td>
                          <td className="py-3 font-mono">{item.sku}</td>
                          <td className="py-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] uppercase ${
                                item.fulfillment_route === "pick"
                                  ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                                  : item.fulfillment_route === "produce"
                                    ? "bg-orange-500/10 border-orange-500/20 text-orange-300"
                                    : "bg-purple-500/10 border-purple-500/20 text-purple-300"
                              }`}
                            >
                              {item.fulfillment_route}
                            </span>
                          </td>
                          <td className="py-3 text-center">{item.quantity}</td>
                          <td className="py-3 text-right">
                            {formatPrice(item.unit_price_cents)}
                          </td>
                          <td className="py-3 text-right font-semibold">
                            {formatPrice(item.unit_price_cents * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedOrder.partnerHandoffs &&
              selectedOrder.partnerHandoffs.length > 0 ? (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <h4 className="mb-3 text-sm font-semibold text-slate-200">
                    Partner Handoffs
                  </h4>
                  <div className="space-y-3">
                    {selectedOrder.partnerHandoffs.map((handoff) => (
                      <div
                        key={handoff.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">
                              {handoff.metadata?.provider_name ||
                                "Assigned Partner"}
                            </p>
                            <p className="text-xs text-slate-300">
                              {handoff.package_stream}
                            </p>
                          </div>
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] uppercase ${
                              handoff.status === "completed"
                                ? "border-green-400/30 bg-green-500/10 text-green-200"
                                : handoff.status === "in_progress"
                                  ? "border-blue-400/30 bg-blue-500/10 text-blue-200"
                                  : handoff.status === "accepted"
                                    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
                                    : handoff.status === "rejected"
                                      ? "border-red-400/30 bg-red-500/10 text-red-200"
                                      : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            {handoff.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        ) : (
          <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl text-slate-400">
            Generate an order on the left panel to begin.
          </div>
        )}
      </div>
    </div>
  );
}

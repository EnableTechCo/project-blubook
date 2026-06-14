"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkflowStepMatrix } from "@/components/ui/workflow-progress";
import { WorkflowStepInputModal } from "@/components/ui/workflow-step-input-modal";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { SALES_WORKFLOW_STATES } from "@/constants/sales-workflow-states";
import { getStreamDisplayName } from "@/constants/stream-display";
import {
  buildAudienceStepView,
  getWorkflowStep,
} from "@/lib/workflow/workflow-step-contract";

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
  metadata?: {
    workflow_timeline?: Array<{ step?: string }>;
  } | null;
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

export function SalesOrdersClient() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const stepEventsQuery = useQuery({
    queryKey: ["step-events", selectedOrder?.id],
    enabled: Boolean(selectedOrder?.id),
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(
        `/api/orders/${selectedOrder!.id}/step-events?audience=sales`,
        { credentials: "include" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) return [];
      return (body?.completedStepKeys ?? []) as string[];
    },
  });
  const [processing, setProcessing] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [pendingStepAction, setPendingStepAction] = useState<{
    action: string;
    label: string;
    stepKey: string;
  } | null>(null);
  const [validationDecisionByOrder, setValidationDecisionByOrder] = useState<
    Record<string, "validated" | "hold">
  >({});
  const [docChecklistByOrder, setDocChecklistByOrder] = useState<
    Record<
      string,
      {
        validationPack: boolean;
        invoicePack: boolean;
        dispatchPack: boolean;
      }
    >
  >({});

  useEffect(() => {
    if (!selectedOrder) {
      console.info("[SalesDashboard] No selected sales order visible", {
        orderCount: orders.length,
      });
      return;
    }

    const completedStepKeys = stepEventsQuery.data ?? [];
    const stepView = buildAudienceStepView({
      audience: "sales",
      completedStepKeys,
    });
    const currentStep = stepView.find((step) => step.current) ?? null;

    console.info("[SalesDashboard] Current purchase order status", {
      orderId: selectedOrder.id,
      poReference: selectedOrder.po_reference,
      status: selectedOrder.status,
      currentStepLabel: currentStep?.label ?? null,
      currentStepKey: currentStep?.key ?? null,
      completedStepCount: completedStepKeys.length,
    });

    console.info("[SalesDashboard] Visible workflow step", {
      orderId: selectedOrder.id,
      poReference: selectedOrder.po_reference,
      orderStatus: selectedOrder.status,
      currentVisibleStep: currentStep
        ? {
            key: currentStep.key,
            label: currentStep.label,
            owner: currentStep.owner,
          }
        : null,
      completedStepKeys,
      visibleSteps: stepView.map((step) => ({
        key: step.key,
        label: step.label,
        completed: step.completed,
        current: step.current,
      })),
    });
  }, [orders.length, selectedOrder, stepEventsQuery.data]);

  const log = useCallback((step: string, details?: unknown) => {
    if (details === undefined) {
      console.log(`[SalesWorkflow] ${step}`);
      return;
    }
    console.log(`[SalesWorkflow] ${step}`, details);
  }, []);

  const selectOrderDetails = useCallback(
    async (order: SalesOrder) => {
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
    },
    [log],
  );

  const fetchOrders = useCallback(
    async (organizationId: string) => {
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
      console.info("[SalesDashboard] Orders list snapshot", {
        total: ordersData?.length ?? 0,
        orders: (ordersData ?? []).map((order) => ({
          id: order.id,
          poReference: order.po_reference,
          status: order.status,
          createdAt: order.created_at,
        })),
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
    },
    [log, selectOrderDetails, selectedOrder],
  );

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

  // Trigger dispatch queue processing via API
  async function triggerQueueDispatch(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

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
      if (!response.ok) {
        throw new Error(result.error || "System queue run failed.");
      }

      if (typeof result.failed === "number" && result.failed > 0) {
        throw new Error(
          `Workflow processed with failures. Events: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`,
        );
      }

      if (!silent) {
        showMsg(
          "success",
          `Workflow processed. Events: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`,
        );
      }

      if (orgId) {
        await fetchOrders(orgId);
      }

      return result;
    } catch (err) {
      log("dispatch:error", err);
      showMsg(
        "error",
        err instanceof Error
          ? err.message
          : "Failed to communicate with system dispatch route.",
      );
      throw err;
    } finally {
      log("dispatch:complete");
      setProcessing(false);
    }
  }

  async function queueWorkflowEventAndDispatch(
    eventType: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!orgId || !selectedOrder) {
      return;
    }

    setProcessing(true);
    try {
      const { error: queueError } = await supabase
        .from("workflow_events_queue")
        .insert({
          event_type: eventType,
          payload,
          status: "queued",
        });

      if (queueError) {
        throw new Error(queueError.message);
      }

      const dispatchResult = await triggerQueueDispatch({ silent: true });
      await fetchOrders(orgId);
      showMsg(
        "success",
        `${successMessage} (Processed: ${dispatchResult.processed}, Succeeded: ${dispatchResult.succeeded})`,
      );
    } catch (error) {
      showMsg(
        "error",
        error instanceof Error
          ? error.message
          : "Could not continue the workflow.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleApplyValidationCheckpoint() {
    if (!selectedOrder) {
      return;
    }

    const decision = validationDecisionByOrder[selectedOrder.id] ?? "validated";

    if (decision === "hold") {
      showMsg(
        "error",
        "Validation marked as hold. Resolve order issues before moving workflow forward.",
      );
      return;
    }

    await queueWorkflowEventAndDispatch(
      "order.validated",
      { orderId: selectedOrder.id },
      "Validation checkpoint submitted. Workflow is continuing.",
    );
  }

  const SALES_ACTION_STEP_KEYS: Record<string, string> = {
    validate: "order_validated",
    reserve_inventory: "inventory_reserved",
    create_handoff: "logistics_handoff_created",
    generate_invoice: "invoice_generated",
    confirm_shipment: "shipment_created",
  };

  function advanceSalesStep(action: string, label: string) {
    if (!selectedOrder) return;
    const stepKey = SALES_ACTION_STEP_KEYS[action] ?? "";
    const contractStep = stepKey ? getWorkflowStep(stepKey) : null;
    const hasRequiredFields =
      contractStep?.inputFields.some((f) => f.required) ?? false;

    if (hasRequiredFields) {
      setPendingStepAction({ action, label, stepKey });
      return;
    }
    // No required fields — skip modal and advance directly
    void advanceSalesStepCore(action, label, {}, "");
  }

  async function advanceSalesStepCore(
    action: string,
    label: string,
    inputData: Record<string, unknown>,
    actorNotes: string,
  ): Promise<string | null> {
    if (!selectedOrder) return "No order selected.";
    const selectedOrderId = selectedOrder.id;
    setProcessing(true);
    try {
      const stepKey = SALES_ACTION_STEP_KEYS[action];
      if (stepKey && Object.keys(inputData).length > 0) {
        const inputRes = await fetch(
          `/api/orders/${selectedOrderId}/step-inputs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ stepKey, inputData, actorNotes }),
          },
        );
        if (!inputRes.ok) {
          const inputBody = await inputRes.json().catch(() => null);
          setProcessing(false);
          return inputBody?.error ?? "Could not save step inputs.";
        }
      }

      const response = await fetch("/api/sales/orders/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: selectedOrder.id, action }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        showMsg("error", result?.error ?? `Could not advance: ${label}`);
        return result?.error ?? `Could not advance: ${label}`;
      }

      console.info("[SalesDashboard] advanceSalesStep:result", {
        action,
        orderId: selectedOrderId,
        from: result?.from ?? null,
        to: result?.to ?? null,
        handoff: result?.handoff ?? null,
      });

      const nextStatus =
        typeof result?.to === "string" ? result.to : selectedOrder.status;

      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrderId
            ? {
                ...order,
                status: nextStatus,
              }
            : order,
        ),
      );

      setSelectedOrder((current) =>
        current && current.id === selectedOrderId
          ? {
              ...current,
              status: nextStatus,
            }
          : current,
      );

      await queryClient.invalidateQueries({
        queryKey: ["step-events", selectedOrderId],
      });

      showMsg("success", `${label} confirmed. Order moved to: ${result.to}`);
      if (orgId) {
        void fetchOrders(orgId);
      }
      return null;
    } catch {
      showMsg("error", `Failed to advance: ${label}`);
      return `Failed to advance: ${label}`;
    } finally {
      setProcessing(false);
    }
  }

  function toggleOrderDoc(
    orderId: string,
    key: "validationPack" | "invoicePack" | "dispatchPack",
    checked: boolean,
  ) {
    setDocChecklistByOrder((current) => ({
      ...current,
      [orderId]: {
        validationPack: current[orderId]?.validationPack ?? false,
        invoicePack: current[orderId]?.invoicePack ?? false,
        dispatchPack: current[orderId]?.dispatchPack ?? false,
        [key]: checked,
      },
    }));
  }

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  const formatPrice = (cents: number) => {
    return `R${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-300">
        Loading sales orders dashboard...
      </div>
    );
  }

  return (
    <>
      {pendingStepAction && selectedOrder ? (
        <WorkflowStepInputModal
          stepKey={pendingStepAction.stepKey}
          orderId={selectedOrder.id}
          actionLabel={pendingStepAction.label}
          onClose={() => setPendingStepAction(null)}
          onConfirm={async (inputData, actorNotes) => {
            const err = await advanceSalesStepCore(
              pendingStepAction.action,
              pendingStepAction.label,
              inputData,
              actorNotes,
            );
            if (!err) setPendingStepAction(null);
            return err;
          }}
        />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Sidebar - Create & List Orders */}
        <div className="xl:col-span-1 space-y-6">
          {/* System Queue Panel */}
          <Card
            title="System Workflow Orchestrator"
            description="Manually execute background queue processing."
          >
            <Button
              variant="ghost"
              className="w-full border-coral/30 hover:bg-coral/10 hover:text-coral"
              disabled={processing}
              onClick={() => {
                void triggerQueueDispatch();
              }}
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
                    type="button"
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

              <WorkflowStepMatrix
                completedStepKeys={stepEventsQuery.data ?? []}
                audience="sales"
                title="Workflow Coverage"
              />

              <Card
                title="Workflow Control Points"
                description="Sales-driven checkpoints that continue workflow execution."
              >
                {(() => {
                  const steps: Array<{
                    number: number;
                    label: string;
                    action: string;
                    requiredStatus: string;
                    hint: string;
                  }> = [
                    {
                      number: 1,
                      label: "Validate Order",
                      action: "validate",
                      requiredStatus: "Purchase Order Received",
                      hint: "Sales acknowledges PO intake and routes fulfillment.",
                    },
                    {
                      number: 2,
                      label: "Reserve Inventory",
                      action: "reserve_inventory",
                      requiredStatus: "Order Validated",
                      hint: "Sales confirms inventory reservation result.",
                    },
                    {
                      number: 3,
                      label: "Create Logistics Handoff",
                      action: "create_handoff",
                      requiredStatus: "Inventory Reserved",
                      hint: "Sales assigns logistics partner and creates handoff.",
                    },
                    {
                      number: 4,
                      label: "Generate Invoice",
                      action: "generate_invoice",
                      requiredStatus: "Logistics Handoff Created",
                      hint: "Sales issues invoice and financial checkpoint.",
                    },
                    {
                      number: 5,
                      label: "Confirm Shipment Created",
                      action: "confirm_shipment",
                      requiredStatus: "Invoice Generated",
                      hint: "Sales confirms shipment creation before logistics takes over.",
                    },
                  ];

                  return (
                    <div className="space-y-2">
                      {steps.map((step) => {
                        const isActive =
                          selectedOrder.status === step.requiredStatus;
                        const isDone = (() => {
                          const statuses = [
                            "Purchase Order Received",
                            "Order Validated",
                            "Inventory Reserved",
                            "Logistics Handoff Created",
                            "Invoice Generated",
                            "Shipment Created",
                          ];
                          const requiredIdx = statuses.indexOf(
                            step.requiredStatus,
                          );
                          const currentIdx = statuses.indexOf(
                            selectedOrder.status,
                          );
                          return currentIdx > requiredIdx;
                        })();

                        return (
                          <div
                            key={step.action}
                            className={`rounded-xl border p-3 ${
                              isDone
                                ? "border-emerald-400/30 bg-emerald-500/10"
                                : isActive
                                  ? "border-cyan-400/40 bg-cyan-500/10"
                                  : "border-white/10 bg-white/5 opacity-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold text-slate-100">
                                  Step {step.number}: {step.label}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {step.hint}
                                </p>
                                {isDone ? (
                                  <p className="mt-1 text-[11px] text-emerald-300">
                                    ✓ Completed
                                  </p>
                                ) : null}
                              </div>
                              {isActive ? (
                                <Button
                                  className="shrink-0 h-8 text-xs"
                                  disabled={processing}
                                  onClick={() =>
                                    advanceSalesStep(step.action, step.label)
                                  }
                                >
                                  {processing ? "..." : step.label}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card>

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
                            <td className="py-3 text-center">
                              {item.quantity}
                            </td>
                            <td className="py-3 text-right">
                              {formatPrice(item.unit_price_cents)}
                            </td>
                            <td className="py-3 text-right font-semibold">
                              {formatPrice(
                                item.unit_price_cents * item.quantity,
                              )}
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
                                {getStreamDisplayName(handoff.package_stream)}
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
    </>
  );
}

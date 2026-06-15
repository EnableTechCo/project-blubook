/**
 * Workflow Step Contract
 *
 * Canonical definition of all 17 interaction-driven workflow steps.
 * This is the single source of truth for:
 * - Step sequencing and guard logic
 * - Input requirements (questions/decisions at each step)
 * - Proof/document requirements
 * - UI rendering and validation
 *
 * NO auto-advance, NO status inference, NO timeline inference.
 * A step is ONLY complete when an explicit event is recorded in order_workflow_step_events.
 */

export type WorkflowStepOwner = "sales" | "logistics";

/**
 * Roles that can see a given workflow step rendered in the UI.
 *
 * - customer  : end-customer portal
 * - sales     : sales ops team
 * - logistics : logistics / fulfilment team
 * - staff     : internal admin / staff (sees everything)
 */
export type WorkflowAudienceRole = "customer" | "sales" | "logistics" | "staff";

export type StepProofType =
  | "purchase-order"
  | "validation-confirmation"
  | "inventory-reservation"
  | "handoff-assignment"
  | "invoice"
  | "shipment-dispatch"
  | "warehouse-transmission"
  | "customer-notification"
  | "packing-verification"
  | "shipping-label"
  | "tracking-info"
  | "delivery-reroute"
  | "arrival-confirmation"
  | "proof-of-delivery"
  | "system-closeout"
  | "completion-confirmation";

export interface WorkflowStepInputField {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number" | "file" | "multi-select";
  required: boolean;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: (value: unknown) => boolean | string;
}

export interface WorkflowStepContractFull {
  key: string;
  label: string;
  owner: WorkflowStepOwner;
  requiresInteraction: true;
  visibleTo: WorkflowAudienceRole[];
  terminal?: boolean;
  description: string;
  allowedPreviousSteps: string[];
  proofRequirements: StepProofType[];
  inputFields: WorkflowStepInputField[];
}

export const WORKFLOW_STEP_CONTRACT: readonly WorkflowStepContractFull[] = [
  // ─── Sales steps (6) ────────────────────────────────────────────────────────
  {
    key: "purchase_order_received",
    label: "Purchase Order Received",
    owner: "sales",
    requiresInteraction: true,
    visibleTo: ["sales", "customer"],
    description:
      "Customer uploads PO; Sales confirms intake and acknowledges receipt.",
    allowedPreviousSteps: [],
    proofRequirements: ["purchase-order"],
    inputFields: [
      {
        key: "po_document_url",
        label: "PO Document URL",
        type: "file",
        required: true,
        description: "Uploaded PDF or image of purchase order",
      },
      {
        key: "customer_po_number",
        label: "Customer PO Number",
        type: "text",
        required: true,
        description: "Customer's reference number for this order",
      },
      {
        key: "sales_rep_comments",
        label: "Initial Assessment",
        type: "text",
        required: false,
        description: "Sales rep initial notes or concerns",
      },
    ],
  },
  {
    key: "order_validated",
    label: "Order Validated",
    owner: "sales",
    requiresInteraction: true,
    visibleTo: ["sales"],
    description:
      "Sales validates PO compliance, pricing, customer account status, and delivery feasibility.",
    allowedPreviousSteps: ["purchase_order_received"],
    proofRequirements: ["validation-confirmation"],
    inputFields: [
      {
        key: "validation_status",
        label: "Validation Result",
        type: "select",
        required: true,
        options: [
          { value: "approved", label: "Approved" },
          {
            value: "approved_with_conditions",
            label: "Approved with Conditions",
          },
          { value: "pending_review", label: "Pending Additional Review" },
        ],
      },
      {
        key: "compliance_notes",
        label: "Compliance Notes",
        type: "text",
        required: false,
        description: "Any issues found during validation",
      },
      {
        key: "customer_credit_verified",
        label: "Customer Credit Verified",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No - Hold for Review" },
        ],
      },
    ],
  },
  {
    key: "inventory_reserved",
    label: "Inventory Reserved",
    owner: "sales",
    requiresInteraction: true,
    visibleTo: ["sales"],
    description:
      "Sales/Ops confirms inventory availability, selects warehouse, handles partial/backorder decisions.",
    allowedPreviousSteps: ["order_validated"],
    proofRequirements: ["inventory-reservation"],
    inputFields: [
      {
        key: "warehouse_id",
        label: "Warehouse Selection",
        type: "select",
        required: true,
        description: "Which distribution center has inventory?",
      },
      {
        key: "quantity_allocated",
        label: "Quantity to Ship",
        type: "number",
        required: true,
        description: "How many units from this warehouse",
      },
      {
        key: "backorder_quantity",
        label: "Backorder Quantity",
        type: "number",
        required: false,
        description: "If partial shipment, how many on backorder",
      },
      {
        key: "backorder_eta",
        label: "Backorder ETA",
        type: "date",
        required: false,
        description: "Expected date for backorder availability",
      },
      {
        key: "substitution_approved",
        label: "Substitution Approved",
        type: "select",
        required: false,
        options: [
          { value: "none", label: "No substitutions" },
          { value: "approved", label: "Approved as requested" },
          { value: "pending_customer", label: "Pending customer approval" },
        ],
      },
      {
        key: "reservation_hold_days",
        label: "Hold Duration (days)",
        type: "number",
        required: true,
        description: "How many days to hold reservation before expiry",
      },
    ],
  },
  {
    key: "logistics_handoff_created",
    label: "Logistics Handoff Created",
    owner: "sales",
    requiresInteraction: true,
    visibleTo: ["sales", "logistics"],
    description:
      "Sales creates formal handoff to logistics partner with all required context and SLA.",
    allowedPreviousSteps: ["inventory_reserved"],
    proofRequirements: ["handoff-assignment"],
    inputFields: [
      {
        key: "logistics_partner_id",
        label: "Logistics Partner",
        type: "select",
        required: true,
        description: "Which logistics provider takes this order",
      },
      {
        key: "service_level",
        label: "Service Level / SLA",
        type: "select",
        required: true,
        options: [
          { value: "standard", label: "Standard (5-7 business days)" },
          { value: "expedited", label: "Expedited (2-3 business days)" },
          { value: "overnight", label: "Overnight" },
        ],
      },
      {
        key: "special_handling_flags",
        label: "Special Handling Requirements",
        type: "multi-select",
        required: false,
        options: [
          { value: "fragile", label: "Fragile - Handle with care" },
          { value: "hazmat", label: "Hazmat - Hazardous materials" },
          { value: "oversized", label: "Oversized - Non-standard dimensions" },
          { value: "temperature_controlled", label: "Temperature Controlled" },
          { value: "signature_required", label: "Signature Required" },
        ],
      },
      {
        key: "delivery_window_preference",
        label: "Delivery Window Preference",
        type: "select",
        required: false,
        options: [
          { value: "business_hours_9_5", label: "Business hours (9-5)" },
          { value: "weekday_only", label: "Weekday only" },
          {
            value: "morning_window",
            label: "Morning window (8:00-12:00)",
          },
          {
            value: "afternoon_window",
            label: "Afternoon window (12:00-17:00)",
          },
          {
            value: "specific_date_required",
            label: "Specific date required",
          },
        ],
      },
    ],
  },
  {
    key: "invoice_generated",
    label: "Invoice Generated",
    owner: "sales",
    requiresInteraction: true,
    visibleTo: ["sales", "customer"],
    description:
      "Sales confirms invoice creation and sends to customer/accounting.",
    allowedPreviousSteps: ["logistics_handoff_created"],
    proofRequirements: ["invoice"],
    inputFields: [
      {
        key: "invoice_number",
        label: "Invoice Number",
        type: "text",
        required: true,
      },
      {
        key: "invoice_amount_cents",
        label: "Invoice Amount (cents)",
        type: "number",
        required: true,
      },
      {
        key: "invoice_url",
        label: "Invoice Document URL",
        type: "file",
        required: true,
      },
      {
        key: "invoice_sent_to",
        label: "Invoice Sent To",
        type: "text",
        required: true,
        description: "Email address(es) invoice was sent to",
      },
    ],
  },
  {
    key: "shipment_created",
    label: "Shipment Created",
    owner: "sales",
    requiresInteraction: true,
    visibleTo: ["sales", "logistics", "customer"],
    description:
      "Sales confirms order is ready for dispatch; formally transitions to logistics execution.",
    allowedPreviousSteps: ["invoice_generated"],
    proofRequirements: ["shipment-dispatch"],
    inputFields: [
      {
        key: "shipment_confirmation",
        label: "Shipment Ready for Dispatch",
        type: "select",
        required: true,
        options: [
          { value: "ready", label: "Ready - All items packed and labeled" },
          {
            value: "pending",
            label: "Pending - Awaiting warehouse preparation",
          },
        ],
      },
      {
        key: "tracking_reference",
        label: "Initial Tracking Reference",
        type: "text",
        required: false,
        description: "Internal reference if pre-generated",
      },
    ],
  },

  // ─── Logistics steps (11) ───────────────────────────────────────────────────
  {
    key: "order_received",
    label: "Order Received",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics", "sales"],
    description:
      "Logistics partner accepts inbound handoff from sales and confirms receipt.",
    allowedPreviousSteps: ["shipment_created"],
    proofRequirements: ["warehouse-transmission"],
    inputFields: [
      {
        key: "handoff_acceptance",
        label: "Handoff Acceptance",
        type: "select",
        required: true,
        options: [
          { value: "accepted", label: "Accepted - Ready to process" },
          { value: "rejected", label: "Rejected - Cannot fulfill" },
        ],
      },
      {
        key: "warehouse_received_at",
        label: "Received at Warehouse",
        type: "date",
        required: true,
        description: "Date order arrived at logistics facility",
      },
      {
        key: "initial_inspection_notes",
        label: "Initial Inspection Notes",
        type: "text",
        required: false,
        description: "Any issues noted upon receipt",
      },
    ],
  },
  {
    key: "order_transmitted_to_warehouse",
    label: "Order Transmitted to Warehouse",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics"],
    description:
      "Logistics confirms order is transmitted to warehouse system for fulfillment.",
    allowedPreviousSteps: ["order_received"],
    proofRequirements: ["warehouse-transmission"],
    inputFields: [
      {
        key: "warehouse_system_reference",
        label: "Warehouse System Reference",
        type: "text",
        required: true,
        description: "WMS order ID or transmission confirmation number",
      },
      {
        key: "transmission_timestamp",
        label: "Transmission Timestamp",
        type: "date",
        required: true,
      },
      {
        key: "expected_fulfillment_date",
        label: "Expected Fulfillment Date",
        type: "date",
        required: true,
        description: "When warehouse expects to complete picking/packing",
      },
    ],
  },
  {
    key: "notify_customer",
    label: "Notify Customer",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics", "customer"],
    description:
      "Logistics sends shipment notification to customer with tracking info.",
    allowedPreviousSteps: ["order_transmitted_to_warehouse"],
    proofRequirements: ["customer-notification"],
    inputFields: [
      {
        key: "notification_sent_to",
        label: "Notification Sent To",
        type: "text",
        required: true,
        description: "Customer email(s) notified",
      },
      {
        key: "notification_type",
        label: "Notification Type",
        type: "select",
        required: true,
        options: [
          { value: "order_ready", label: "Order Ready for Shipment" },
          { value: "shipped", label: "Order Shipped" },
          { value: "in_transit", label: "Order In Transit" },
        ],
      },
      {
        key: "notification_sent_at",
        label: "Sent At",
        type: "date",
        required: true,
      },
    ],
  },
  {
    key: "pack_items_for_shipment",
    label: "Pack Items for Shipment",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics"],
    description:
      "Logistics confirms physical packing is complete with quality verification.",
    allowedPreviousSteps: ["notify_customer"],
    proofRequirements: ["packing-verification"],
    inputFields: [
      {
        key: "packing_complete_date",
        label: "Packing Completed On",
        type: "date",
        required: true,
      },
      {
        key: "quality_check_performed",
        label: "Quality Check Performed",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes - No issues" },
          { value: "yes_with_notes", label: "Yes - See notes" },
          { value: "exception", label: "Exception - Item damaged/missing" },
        ],
      },
      {
        key: "quality_check_notes",
        label: "Quality Check Notes",
        type: "text",
        required: false,
        description: "Any damage, missing items, or concerns noted",
      },
      {
        key: "packing_photos",
        label: "Packing Verification Photos",
        type: "file",
        required: false,
        description: "Photos of packed items and box condition",
      },
      {
        key: "total_weight_kg",
        label: "Total Weight (kg)",
        type: "number",
        required: true,
      },
      {
        key: "box_dimensions",
        label: "Box Dimensions (L×W×H cm)",
        type: "text",
        required: true,
        description: "E.g., '40×30×25'",
      },
    ],
  },
  {
    key: "generate_shipping_label_documentation",
    label: "Generate Shipping Label & Documentation",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics"],
    description:
      "Logistics generates shipping label, customs docs, and compliance paperwork.",
    allowedPreviousSteps: ["pack_items_for_shipment"],
    proofRequirements: ["shipping-label"],
    inputFields: [
      {
        key: "carrier",
        label: "Shipping Carrier",
        type: "select",
        required: true,
        options: [
          { value: "fedex", label: "FedEx" },
          { value: "ups", label: "UPS" },
          { value: "usps", label: "USPS" },
          { value: "dhl", label: "DHL" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "tracking_number",
        label: "Tracking Number",
        type: "text",
        required: true,
      },
      {
        key: "shipping_label_url",
        label: "Shipping Label URL",
        type: "file",
        required: true,
      },
      {
        key: "customs_documentation",
        label: "Customs Documentation Required",
        type: "select",
        required: true,
        options: [
          { value: "no", label: "No (domestic)" },
          { value: "yes", label: "Yes (international)" },
        ],
      },
      {
        key: "customs_doc_urls",
        label: "Customs Documents",
        type: "file",
        required: false,
        description:
          "Commercial invoice, packing list, etc. for international orders",
      },
      {
        key: "insurance_selected",
        label: "Shipping Insurance",
        type: "select",
        required: false,
        options: [
          { value: "none", label: "None" },
          { value: "standard", label: "Standard Coverage" },
          { value: "full", label: "Full Value Coverage" },
        ],
      },
    ],
  },
  {
    key: "track_shipment_in_transit",
    label: "Track Shipment In Transit",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics", "customer"],
    description: "Logistics confirms shipment dispatch and activates tracking.",
    allowedPreviousSteps: ["generate_shipping_label_documentation"],
    proofRequirements: ["tracking-info"],
    inputFields: [
      {
        key: "dispatch_date",
        label: "Dispatch Date",
        type: "date",
        required: true,
        description: "When shipment left warehouse",
      },
      {
        key: "carrier_tracking_active",
        label: "Carrier Tracking Active",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes - Tracking live" },
          { value: "pending", label: "Pending - Will activate within 24h" },
        ],
      },
      {
        key: "estimated_delivery",
        label: "Estimated Delivery Date",
        type: "date",
        required: true,
      },
    ],
  },
  {
    key: "reroute_delivery",
    label: "Reroute Delivery",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics"],
    description:
      "Exception step: Logistics handles delivery changes, address corrections, or holds.",
    allowedPreviousSteps: ["track_shipment_in_transit"],
    proofRequirements: ["delivery-reroute"],
    inputFields: [
      {
        key: "reroute_reason",
        label: "Reroute Reason",
        type: "select",
        required: true,
        options: [
          { value: "address_change", label: "Address Change" },
          { value: "customer_hold", label: "Customer Hold Request" },
          {
            value: "delivery_exception",
            label: "Delivery Exception (damaged, etc)",
          },
          { value: "return_to_sender", label: "Return to Sender" },
        ],
      },
      {
        key: "new_delivery_address",
        label: "New Delivery Address",
        type: "text",
        required: false,
        description: "If address change",
      },
      {
        key: "reroute_approval",
        label: "Customer Approval",
        type: "select",
        required: true,
        options: [
          { value: "approved", label: "Approved" },
          { value: "pending", label: "Pending" },
        ],
      },
    ],
  },
  {
    key: "order_arrives_at_destination",
    label: "Order Arrives at Destination",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics", "customer"],
    description: "Logistics confirms arrival at delivery location.",
    allowedPreviousSteps: ["track_shipment_in_transit", "reroute_delivery"],
    proofRequirements: ["arrival-confirmation"],
    inputFields: [
      {
        key: "arrival_date",
        label: "Arrival Date",
        type: "date",
        required: true,
      },
      {
        key: "arrival_condition",
        label: "Shipment Condition on Arrival",
        type: "select",
        required: true,
        options: [
          { value: "good", label: "Good - No visible damage" },
          { value: "damaged", label: "Damaged - See notes" },
          { value: "incomplete", label: "Incomplete - Items missing" },
        ],
      },
      {
        key: "arrival_photos",
        label: "Arrival Condition Photos",
        type: "file",
        required: false,
      },
    ],
  },
  {
    key: "customer_receives_signs_pod",
    label: "Customer Receives & Signs POD",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics", "customer"],
    description:
      "Customer receives shipment and signs proof-of-delivery. Hard gate for terminal completion.",
    allowedPreviousSteps: ["order_arrives_at_destination"],
    proofRequirements: ["proof-of-delivery"],
    inputFields: [
      {
        key: "pod_signature_url",
        label: "POD Signature",
        type: "file",
        required: true,
        description: "Scanned or digital signature from recipient",
      },
      {
        key: "recipient_name",
        label: "Recipient Name",
        type: "text",
        required: true,
      },
      {
        key: "pod_signed_date",
        label: "POD Signed Date",
        type: "date",
        required: true,
      },
      {
        key: "receipt_condition_assessment",
        label: "Customer Condition Assessment",
        type: "select",
        required: true,
        options: [
          { value: "good", label: "Good - No issues reported" },
          { value: "damaged", label: "Damaged - Customer noted damage" },
          { value: "incomplete", label: "Incomplete - Items missing" },
        ],
      },
      {
        key: "damage_notes",
        label: "Damage/Issue Details",
        type: "text",
        required: false,
        description: "If customer reported issues",
      },
      {
        key: "pod_photos",
        label: "POD Photos",
        type: "file",
        required: false,
        description: "Photos of signed POD and shipment condition",
      },
    ],
  },
  {
    key: "blubook_system_updated",
    label: "BluBook System Updated",
    owner: "logistics",
    requiresInteraction: true,
    visibleTo: ["logistics"],
    description:
      "Logistics confirms all systems updated, financial closeout, and records finalized.",
    allowedPreviousSteps: ["customer_receives_signs_pod"],
    proofRequirements: ["system-closeout"],
    inputFields: [
      {
        key: "inventory_updated",
        label: "Inventory System Updated",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "pending", label: "Pending" },
        ],
      },
      {
        key: "financial_reconciled",
        label: "Financial Records Reconciled",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "pending", label: "Pending" },
        ],
      },
      {
        key: "customer_account_updated",
        label: "Customer Account Updated",
        type: "select",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "pending", label: "Pending" },
        ],
      },
      {
        key: "system_notes",
        label: "Closeout Notes",
        type: "text",
        required: false,
      },
    ],
  },
  {
    key: "delivered",
    label: "Delivered",
    owner: "logistics",
    requiresInteraction: true,
    terminal: true,
    visibleTo: ["logistics", "sales", "customer"],
    description:
      "Terminal: Order successfully delivered. Only possible after POD signed AND system updated.",
    allowedPreviousSteps: ["blubook_system_updated"],
    proofRequirements: ["proof-of-delivery"],
    inputFields: [
      {
        key: "final_confirmation",
        label: "Final Delivery Confirmation",
        type: "select",
        required: true,
        options: [
          {
            value: "confirmed",
            label: "Confirmed - Order delivered successfully",
          },
        ],
      },
      {
        key: "customer_satisfaction_check",
        label: "Customer Satisfaction Check",
        type: "select",
        required: false,
        options: [
          { value: "satisfied", label: "Satisfied" },
          { value: "issues", label: "Issues Reported - See notes" },
          { value: "not_contacted", label: "Not Yet Contacted" },
        ],
      },
    ],
  },
] as const;

export const WORKFLOW_STEP_COUNT = WORKFLOW_STEP_CONTRACT.length;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get all steps for an owner (sales or logistics)
 */
export function getWorkflowStepsByOwner(owner: WorkflowStepOwner) {
  return WORKFLOW_STEP_CONTRACT.filter((step) => step.owner === owner);
}

/**
 * Validate that a step transition is allowed.
 * Returns true if nextStepKey can follow currentStepKey.
 */
export function isValidTransition(
  currentStepKey: string,
  nextStepKey: string,
): boolean {
  const nextStep = WORKFLOW_STEP_CONTRACT.find((s) => s.key === nextStepKey);
  if (!nextStep) return false;
  return nextStep.allowedPreviousSteps.includes(currentStepKey);
}

/**
 * Get all allowed next steps from a current step.
 */
export function getNextAllowedSteps(currentStepKey: string): string[] {
  return WORKFLOW_STEP_CONTRACT.filter((step) =>
    step.allowedPreviousSteps.includes(currentStepKey),
  ).map((step) => step.key);
}

/**
 * Returns contract steps visible to the given audience role.
 * staff always receives the full contract.
 */
export function getWorkflowStepsForAudience(
  audience: WorkflowAudienceRole,
): readonly WorkflowStepContractFull[] {
  if (audience === "staff") {
    return WORKFLOW_STEP_CONTRACT;
  }
  return WORKFLOW_STEP_CONTRACT.filter((step) =>
    step.visibleTo.includes(audience),
  );
}

/**
 * Get a specific step by key.
 */
export function getWorkflowStep(
  stepKey: string,
): WorkflowStepContractFull | undefined {
  return WORKFLOW_STEP_CONTRACT.find((s) => s.key === stepKey);
}

export const DELIVERED_PROOF_REQUIREMENTS: StepProofType[] =
  WORKFLOW_STEP_CONTRACT.find((s) => s.key === "delivered")
    ?.proofRequirements ?? [];

// ─── Audience step view ───────────────────────────────────────────────────────

export type AudienceStepViewItem = {
  key: string;
  label: string;
  owner: WorkflowStepOwner;
  terminal: boolean;
  proofRequirements: StepProofType[];
  visibleTo: WorkflowAudienceRole[];
  completed: boolean;
  /** True for the first incomplete step in the visible list. */
  current: boolean;
};

/**
 * Build the audience-filtered view of workflow steps with event-driven
 * completion state.  No status/timeline inference — completion is determined
 * solely by the completedStepKeys set.
 */
export function buildAudienceStepView(input: {
  audience: WorkflowAudienceRole;
  completedStepKeys: string[];
}): AudienceStepViewItem[] {
  const { audience, completedStepKeys } = input;
  const completedSet = new Set(completedStepKeys);

  const visibleSteps = getWorkflowStepsForAudience(audience);
  const firstIncompleteKey =
    visibleSteps.find((s) => !completedSet.has(s.key))?.key ?? null;

  return visibleSteps.map((step) => ({
    key: step.key,
    label: step.label,
    owner: step.owner,
    terminal: step.terminal ?? false,
    proofRequirements: step.proofRequirements,
    visibleTo: step.visibleTo,
    completed: completedSet.has(step.key),
    current: step.key === firstIncompleteKey,
  }));
}

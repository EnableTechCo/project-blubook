export type WorkspaceContent = {
  phase: string;
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string; hint: string }>;
  streams: Array<{ title: string; items: string[] }>;
};

export const WORKSPACE_CONTENT: Record<string, WorkspaceContent> = {
  salesOrders: {
    phase: "Phase 3",
    title: "Sales Orders",
    subtitle: "Live sales order lifecycle and workflow progression.",
    metrics: [
      { label: "Orders", value: "Live", hint: "Data from current workspace" },
      {
        label: "Validation",
        value: "Live",
        hint: "Current validation stage coverage",
      },
      {
        label: "Handoffs",
        value: "Live",
        hint: "Active sales-to-logistics handoffs",
      },
      {
        label: "Queue Health",
        value: "Live",
        hint: "Workflow queue and processing status",
      },
    ],
    streams: [
      {
        title: "Order Lifecycle",
        items: [
          "Receive and validate purchase orders",
          "Reserve inventory and advance workflow steps",
          "Create logistics handoff and close the order",
        ],
      },
      {
        title: "Controls",
        items: [
          "Step-based transition guardrails",
          "Audit-safe workflow events",
          "Role-based progression controls",
        ],
      },
    ],
  },
  salesWorkOrders: {
    phase: "Phase 3",
    title: "Sales Work Orders",
    subtitle: "Live work-order operations for execution teams.",
    metrics: [
      { label: "Assigned", value: "Live", hint: "Current assigned work" },
      { label: "In Progress", value: "Live", hint: "Execution in progress" },
      { label: "Blocked", value: "Live", hint: "Items needing intervention" },
      { label: "Completed", value: "Live", hint: "Finished work orders" },
    ],
    streams: [
      {
        title: "Execution",
        items: [
          "Accept and start assigned work",
          "Capture required step inputs",
          "Complete work with evidence",
        ],
      },
      {
        title: "Governance",
        items: [
          "Enforce required documents",
          "Track SLA-sensitive transitions",
          "Publish completion events",
        ],
      },
    ],
  },
  salesInvoices: {
    phase: "Phase 3",
    title: "Sales Invoices",
    subtitle: "Invoice lifecycle and billing operations.",
    metrics: [
      { label: "Issued", value: "Live", hint: "Issued invoices" },
      { label: "Open", value: "Live", hint: "Outstanding balance" },
      { label: "Paid", value: "Live", hint: "Settled invoices" },
      { label: "Overdue", value: "Live", hint: "Requires follow-up" },
    ],
    streams: [
      {
        title: "Billing",
        items: [
          "Generate invoices from completed work",
          "Attach supporting evidence",
          "Track due dates and status",
        ],
      },
      {
        title: "Collections",
        items: [
          "Monitor overdue invoices",
          "Escalate payment issues",
          "Update collection outcomes",
        ],
      },
    ],
  },
  salesInventory: {
    phase: "Phase 3",
    title: "Inventory",
    subtitle: "Inventory allocation and fulfillment readiness.",
    metrics: [
      { label: "Stock", value: "Live", hint: "Available inventory" },
      { label: "Reserved", value: "Live", hint: "Allocated inventory" },
      { label: "Low Stock", value: "Live", hint: "Reorder candidates" },
      { label: "Backorder", value: "Live", hint: "Pending supply" },
    ],
    streams: [
      {
        title: "Allocation",
        items: [
          "Reserve stock for validated orders",
          "Release stock when required",
          "Keep fulfillment state aligned",
        ],
      },
      {
        title: "Planning",
        items: [
          "Track demand patterns",
          "Prevent stockouts",
          "Support supplier planning",
        ],
      },
    ],
  },
  logisticsShipments: {
    phase: "Phase 3",
    title: "Shipments",
    subtitle: "Shipment lifecycle from dispatch to delivery.",
    metrics: [
      { label: "Created", value: "Live", hint: "Shipment records" },
      { label: "In Transit", value: "Live", hint: "Active deliveries" },
      { label: "Delivered", value: "Live", hint: "Completed shipments" },
      { label: "Exceptions", value: "Live", hint: "Requires action" },
    ],
    streams: [
      {
        title: "Dispatch",
        items: [
          "Assign shipments to logistics partners",
          "Track transit milestones",
          "Handle route exceptions",
        ],
      },
      {
        title: "Proof",
        items: [
          "Collect proof of delivery",
          "Validate required evidence",
          "Finalize delivered status",
        ],
      },
    ],
  },
  logisticsCarriers: {
    phase: "Phase 3",
    title: "Carriers",
    subtitle: "Carrier network and delivery partner operations.",
    metrics: [
      { label: "Active", value: "Live", hint: "Active carriers" },
      { label: "On-Time", value: "Live", hint: "Delivery performance" },
      { label: "Claims", value: "Live", hint: "Open incidents" },
      { label: "Routes", value: "Live", hint: "Operational lanes" },
    ],
    streams: [
      {
        title: "Registry",
        items: [
          "Manage carrier profiles",
          "Map lane capabilities",
          "Track compliance requirements",
        ],
      },
      {
        title: "Performance",
        items: [
          "Measure SLA outcomes",
          "Review exception trends",
          "Adjust partner allocation",
        ],
      },
    ],
  },
  logisticsTracking: {
    phase: "Phase 3",
    title: "Tracking",
    subtitle: "Live tracking signals and milestone events.",
    metrics: [
      { label: "Live Feeds", value: "Live", hint: "Current tracking feeds" },
      { label: "Milestones", value: "Live", hint: "Recent state events" },
      { label: "Delayed", value: "Live", hint: "Potential SLA risks" },
      { label: "Recovered", value: "Live", hint: "Resolved exceptions" },
    ],
    streams: [
      {
        title: "Signals",
        items: [
          "Receive carrier updates",
          "Maintain timeline accuracy",
          "Detect ETA drift",
        ],
      },
      {
        title: "Escalations",
        items: [
          "Flag SLA-sensitive delays",
          "Notify internal owners",
          "Track resolution outcomes",
        ],
      },
    ],
  },
  logisticsDelivery: {
    phase: "Phase 3",
    title: "Delivery",
    subtitle: "Final-mile confirmation and closure controls.",
    metrics: [
      { label: "Delivered", value: "Live", hint: "Confirmed deliveries" },
      { label: "POD", value: "Live", hint: "Proof-of-delivery status" },
      { label: "Failed", value: "Live", hint: "Retry needed" },
      { label: "Pending", value: "Live", hint: "Awaiting completion" },
    ],
    streams: [
      {
        title: "Confirmation",
        items: [
          "Capture delivery completion",
          "Validate recipient proof",
          "Close final workflow steps",
        ],
      },
      {
        title: "Exceptions",
        items: [
          "Handle failed delivery attempts",
          "Trigger follow-up actions",
          "Maintain audit trace",
        ],
      },
    ],
  },
  adminRoles: {
    phase: "Phase 4",
    title: "Roles and Permissions",
    subtitle: "Role governance and access control management.",
    metrics: [
      { label: "Roles", value: "Live", hint: "Configured role models" },
      { label: "Permissions", value: "Live", hint: "Access rules" },
      { label: "Overrides", value: "Live", hint: "Exceptional grants" },
      { label: "Review", value: "Live", hint: "Policy review queue" },
    ],
    streams: [
      {
        title: "Policy",
        items: [
          "Manage role templates",
          "Review permission matrices",
          "Publish policy updates",
        ],
      },
      {
        title: "Safety",
        items: [
          "Track sensitive changes",
          "Prevent access drift",
          "Keep immutable audit history",
        ],
      },
    ],
  },
  adminSettings: {
    phase: "Phase 4",
    title: "System Settings",
    subtitle: "Platform settings and workflow defaults.",
    metrics: [
      { label: "Rules", value: "Live", hint: "Active configuration rules" },
      { label: "SLA Profiles", value: "Live", hint: "Operational baselines" },
      { label: "Flags", value: "Live", hint: "Runtime toggles" },
      { label: "Tenants", value: "Live", hint: "Workspace coverage" },
    ],
    streams: [
      {
        title: "Configuration",
        items: [
          "Manage workflow defaults",
          "Maintain notification behavior",
          "Control feature switches",
        ],
      },
      {
        title: "Compliance",
        items: [
          "Track configuration history",
          "Apply approvals for sensitive changes",
          "Support rollback when required",
        ],
      },
    ],
  },
  adminAuditLogs: {
    phase: "Phase 4",
    title: "Audit Logs",
    subtitle: "Security and compliance event traceability.",
    metrics: [
      { label: "Events", value: "Live", hint: "Tracked activities" },
      { label: "Critical", value: "Live", hint: "Security-sensitive events" },
      { label: "Exports", value: "Live", hint: "Compliance exports" },
      { label: "Retention", value: "Live", hint: "Policy lifecycle" },
    ],
    streams: [
      {
        title: "Traceability",
        items: [
          "Capture actor and action history",
          "Correlate workflow events",
          "Support investigations",
        ],
      },
      {
        title: "Investigation",
        items: [
          "Filter by severity and time",
          "Export evidence for audits",
          "Track remediation actions",
        ],
      },
    ],
  },
  adminUsers: {
    phase: "Phase 4",
    title: "User Management",
    subtitle: "Identity lifecycle and access administration.",
    metrics: [
      { label: "Invited", value: "Live", hint: "Pending acceptance" },
      { label: "Active", value: "Live", hint: "Current users" },
      { label: "Suspended", value: "Live", hint: "Restricted accounts" },
      { label: "Admins", value: "Live", hint: "Privileged users" },
    ],
    streams: [
      {
        title: "Identity",
        items: [
          "Manage user lifecycle",
          "Maintain role assignments",
          "Handle onboarding states",
        ],
      },
      {
        title: "Access",
        items: [
          "Control session access",
          "Review risk indicators",
          "Audit permission changes",
        ],
      },
    ],
  },
};

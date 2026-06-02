import { MOCK_USERS } from "./core-data";
import type {
  MockWorkspaceData,
  MockWorkspaceMetric,
  MockWorkspaceStream,
} from "./types";

export const MOCK_SALES_ORDERS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Sales Orders",
  subtitle:
    "Customer purchase orders through validation and workflow transitions.",
  metrics: [
    { label: "PO Received", value: "28", hint: "Current queue" },
    { label: "Validated", value: "21", hint: "Ready for reservation" },
    { label: "Reserved", value: "19", hint: "Inventory locked" },
    { label: "Shipped", value: "12", hint: "Completed flow" },
  ],
  streams: [
    {
      title: "Order Governance",
      items: [
        "Customer PO intake with schema checks",
        "Validation rules and exception review",
        "Automatic work-order generation trigger",
      ],
    },
    {
      title: "Execution Handoff",
      items: [
        "Inventory reservation linkage",
        "Pick ticket and manufacturing queue sync",
        "Shipment handoff status broadcast",
      ],
    },
  ],
};

export const MOCK_SALES_WORK_ORDERS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Sales Work Orders",
  subtitle:
    "Generate and manage work orders with manufacturing and packaging states.",
  metrics: [
    { label: "Generated", value: "34", hint: "From validated orders" },
    { label: "Manufacturing", value: "14", hint: "Active production" },
    { label: "Packaging", value: "8", hint: "Ready to dispatch" },
    { label: "Blocked", value: "2", hint: "Needs intervention" },
  ],
  streams: [
    {
      title: "Production Stream",
      items: [
        "Queue orders into manufacturing",
        "Track output and quality gates",
        "Route to packaging and dispatch",
      ],
    },
    {
      title: "Control Stream",
      items: [
        "Assign partner execution owners",
        "Raise blockers and remediation tasks",
        "Publish completion events to billing",
      ],
    },
  ],
};

export const MOCK_SALES_INVOICES_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Sales Invoices",
  subtitle:
    "Invoice generation, billing workflows and payment status lifecycle.",
  metrics: [
    { label: "Generated", value: "52", hint: "Current month" },
    { label: "Outstanding", value: "11", hint: "Awaiting payment" },
    { label: "Paid", value: "39", hint: "Settled invoices" },
    { label: "Overdue", value: "2", hint: "Action required" },
  ],
  streams: [
    {
      title: "Billing Stream",
      items: [
        "Generate invoice from completed workflow",
        "Attach billing documents and delivery proofs",
        "Track payment terms and due windows",
      ],
    },
    {
      title: "Collections Stream",
      items: [
        "Auto-reminders for due invoices",
        "Escalate overdue accounts",
        "Reconcile receipts into reporting",
      ],
    },
  ],
};

export const MOCK_SALES_INVENTORY_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Inventory",
  subtitle:
    "Allocation views to support order reservation and fulfillment planning.",
  metrics: [
    { label: "SKUs", value: "318", hint: "Catalog coverage" },
    { label: "Reserved", value: "126", hint: "Allocated units" },
    { label: "Low Stock", value: "9", hint: "Procurement trigger" },
    { label: "Backorder", value: "4", hint: "Needs supplier" },
  ],
  streams: [
    {
      title: "Allocation Stream",
      items: [
        "Reserve stock per order state",
        "Manage pick-ticket commitments",
        "Release stock on cancellation events",
      ],
    },
    {
      title: "Planning Stream",
      items: [
        "Demand trend monitoring",
        "Supplier replenishment planning",
        "Threshold-driven low-stock alerts",
      ],
    },
  ],
};

export const MOCK_PARTNER_MESSAGES_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 2",
  title: "Partner Messages",
  subtitle: "Realtime communication with customers and internal staff.",
  metrics: [
    { label: "Active Threads", value: "18", hint: "Open conversations" },
    { label: "Unread", value: "6", hint: "Pending responses" },
    { label: "Avg Reply", value: "12m", hint: "Partner response time" },
    { label: "Attachments", value: "42", hint: "Shared this week" },
  ],
  streams: [
    {
      title: "Realtime Layer",
      items: [
        "Presence channels for active participants",
        "Read receipts and delivery states",
        "Typing indicators for faster coordination",
      ],
    },
    {
      title: "Governance",
      items: [
        "RLS-scoped thread visibility",
        "Attachment policy checks",
        "Message audit metadata retention",
      ],
    },
  ],
};

export const MOCK_PARTNER_WORK_ORDERS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 2",
  title: "Partner Work Orders",
  subtitle:
    "Accept, reject and progress assigned operations with completion evidence.",
  metrics: [
    { label: "Pending Accept", value: "5", hint: "Requires decision" },
    { label: "Accepted", value: "17", hint: "Committed work" },
    { label: "Completed", value: "64", hint: "Historical throughput" },
    { label: "Rejected", value: "2", hint: "Escalated to ops" },
  ],
  streams: [
    {
      title: "Lifecycle",
      items: [
        "Accept/reject SLA-bound assignments",
        "Update progress milestones",
        "Submit completion evidence and close",
      ],
    },
    {
      title: "Integration",
      items: [
        "Sync state to service_requests",
        "Trigger logistics handoff events",
        "Emit customer-facing notifications",
      ],
    },
  ],
};

export const MOCK_CUSTOMER_SETTINGS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 2",
  title: "Customer Settings",
  subtitle:
    "Profile, notification preferences, security controls and organization preferences.",
  metrics: [
    { label: "Profiles", value: "1", hint: "Active account" },
    { label: "Channels", value: "3", hint: "In-app, Email, SMS" },
    { label: "MFA", value: "Off", hint: "Security posture" },
    { label: "Sessions", value: "2", hint: "Recent logins" },
  ],
  streams: [
    {
      title: "Profile Controls",
      items: [
        "Update contact and company details",
        "Configure default request metadata",
        "Manage personal display preferences",
      ],
    },
    {
      title: "Security Controls",
      items: [
        "Password and MFA management",
        "Notification channel preferences",
        "Session and device revocation",
      ],
    },
  ],
};

export const MOCK_ADMIN_ROLES_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 4",
  title: "Roles and Permissions",
  subtitle:
    "RBAC management for customer, partner, staff and admin capabilities.",
  metrics: [
    { label: "Roles", value: "12", hint: "Configured templates" },
    { label: "Permissions", value: "86", hint: "Action controls" },
    { label: "Overrides", value: "5", hint: "Custom grants" },
    { label: "Pending Review", value: "2", hint: "Policy changes" },
  ],
  streams: [
    {
      title: "Policy Stream",
      items: [
        "Role template management",
        "Permission matrix governance",
        "Scope-based policy publication",
      ],
    },
    {
      title: "Safety Stream",
      items: [
        "Change simulation and dry-run",
        "Conflict detection on overrides",
        "Audit trail for grants and revocations",
      ],
    },
  ],
};

export const MOCK_ADMIN_SETTINGS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 4",
  title: "System Settings",
  subtitle:
    "Platform-level config for notifications, workflow defaults and tenant controls.",
  metrics: [
    { label: "Notification Rules", value: "24", hint: "Active triggers" },
    { label: "SLA Profiles", value: "7", hint: "Department baselines" },
    { label: "Feature Flags", value: "13", hint: "Runtime toggles" },
    { label: "Tenants", value: "1", hint: "Current workspace" },
  ],
  streams: [
    {
      title: "Configuration Stream",
      items: [
        "Notification channel defaults",
        "Workflow SLA and escalation knobs",
        "Platform behavior flags",
      ],
    },
    {
      title: "Compliance Stream",
      items: [
        "Settings version history",
        "Change approval workflow",
        "Rollback and recovery snapshots",
      ],
    },
  ],
};

export const MOCK_ADMIN_AUDIT_LOGS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 4",
  title: "Audit Logs",
  subtitle:
    "Tamper-evident activity tracking for critical actions and security events.",
  metrics: [
    { label: "Events", value: "4,321", hint: "Last 30 days" },
    { label: "Critical", value: "3", hint: "Security-sensitive" },
    { label: "Exports", value: "6", hint: "Compliance pulls" },
    { label: "Retention", value: "365d", hint: "Configured policy" },
  ],
  streams: [
    {
      title: "Traceability Stream",
      items: [
        "Actor/action/entity event capture",
        "Immutable metadata and context",
        "Correlation with workflow transitions",
      ],
    },
    {
      title: "Investigation Stream",
      items: [
        "Severity and time-range filtering",
        "Bulk export for compliance",
        "Escalation tagging and notes",
      ],
    },
  ],
};

export const MOCK_ADMIN_WORKFLOWS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 4",
  title: "Workflow Configuration",
  subtitle:
    "Configure sales, logistics and request state machines with guardrails.",
  metrics: [
    { label: "Active Workflows", value: "9", hint: "Published models" },
    { label: "Automations", value: "31", hint: "Event rules" },
    { label: "Versions", value: "22", hint: "Historical revisions" },
    { label: "Rollbacks", value: "1", hint: "Last 90 days" },
  ],
  streams: [
    {
      title: "Design Stream",
      items: [
        "State transition modeling",
        "Guard condition configuration",
        "Notification and side-effect rules",
      ],
    },
    {
      title: "Release Stream",
      items: [
        "Versioned publish process",
        "Impact simulation before deploy",
        "Rollback and hotfix controls",
      ],
    },
  ],
};

export const MOCK_LOGISTICS_SHIPMENTS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Shipments",
  subtitle:
    "Manage shipment lifecycle from warehouse processing to delivery completion.",
  metrics: [
    { label: "Created", value: "31", hint: "Dispatch queue" },
    { label: "In Transit", value: "18", hint: "Active movement" },
    { label: "Delivered", value: "12", hint: "Closed shipments" },
    { label: "Exceptions", value: "1", hint: "Delayed or failed" },
  ],
  streams: [
    {
      title: "Dispatch Stream",
      items: [
        "Warehouse routing and wave planning",
        "Carrier assignment and manifesting",
        "Shipment status event publication",
      ],
    },
    {
      title: "Proof Stream",
      items: [
        "Delivery confirmation capture",
        "Proof-of-delivery artifact upload",
        "Exception route to support desk",
      ],
    },
  ],
};

export const MOCK_LOGISTICS_CARRIERS_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Carriers",
  subtitle: "Carrier registry, assignment rules and performance scorecards.",
  metrics: [
    { label: "Active Carriers", value: "11", hint: "Integrated providers" },
    { label: "On-Time", value: "94%", hint: "Rolling 30 days" },
    { label: "Claims", value: "3", hint: "Open incidents" },
    { label: "Routes", value: "42", hint: "Assigned lanes" },
  ],
  streams: [
    {
      title: "Registry Stream",
      items: [
        "Carrier profile lifecycle",
        "Service lane capability mapping",
        "Compliance document tracking",
      ],
    },
    {
      title: "Performance Stream",
      items: [
        "On-time and damage metrics",
        "Claims and exception analysis",
        "Automatic carrier scoring updates",
      ],
    },
  ],
};

export const MOCK_LOGISTICS_TRACKING_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Tracking",
  subtitle:
    "Live tracking updates with realtime status broadcasts and milestone timeline.",
  metrics: [
    { label: "Live Feeds", value: "18", hint: "Open channels" },
    { label: "Milestones", value: "126", hint: "Events today" },
    { label: "Delayed", value: "2", hint: "Attention needed" },
    { label: "Recovered", value: "5", hint: "Resolved delays" },
  ],
  streams: [
    {
      title: "Signal Stream",
      items: [
        "Realtime carrier status subscriptions",
        "Milestone sequencing and deduplication",
        "Route ETA drift detection",
      ],
    },
    {
      title: "Escalation Stream",
      items: [
        "Delay threshold alerts",
        "Customer and ops notification fanout",
        "Incident correlation with audit trail",
      ],
    },
  ],
};

export const MOCK_LOGISTICS_DELIVERY_WORKSPACE: MockWorkspaceData = {
  phase: "Phase 3",
  title: "Delivery",
  subtitle:
    "Delivery confirmations, proof-of-delivery uploads and exception workflows.",
  metrics: [
    { label: "Delivered Today", value: "47", hint: "Confirmed drop-offs" },
    { label: "POD Received", value: "43", hint: "Proof artifacts" },
    { label: "Failed", value: "2", hint: "Retry required" },
    { label: "Awaiting POD", value: "4", hint: "Pending upload" },
  ],
  streams: [
    {
      title: "Confirmation Stream",
      items: [
        "Capture delivery time and geodata",
        "Store recipient acknowledgement",
        "Close shipment on validation",
      ],
    },
    {
      title: "Exception Stream",
      items: [
        "Route failed attempts to support",
        "Plan re-delivery operations",
        "Notify customers and partners",
      ],
    },
  ],
};

const countByStatus = (status: "invited" | "active" | "suspended") =>
  MOCK_USERS.filter((user) => user.status === status).length;

const countByRole = (role: "customer" | "partner" | "staff" | "admin") =>
  MOCK_USERS.filter((user) => user.role === role).length;

export const buildMockAdminUserMetrics = (): MockWorkspaceMetric[] => [
  {
    label: "Invited",
    value: String(countByStatus("invited")),
    hint: "Pending acceptance",
  },
  {
    label: "Active",
    value: String(countByStatus("active")),
    hint: "Current users",
  },
  {
    label: "Suspended",
    value: String(countByStatus("suspended")),
    hint: "Restricted accounts",
  },
  {
    label: "Admins",
    value: String(countByRole("admin")),
    hint: "Privileged users",
  },
];

export const MOCK_ADMIN_USER_STREAMS: MockWorkspaceStream[] = [
  {
    title: "Identity Stream",
    items: [
      "Invite and onboarding pipeline",
      "Role/department assignment controls",
      "Account lifecycle transitions",
    ],
  },
  {
    title: "Access Stream",
    items: [
      "Session revocation and lockouts",
      "Risk-based user reviews",
      "Auth activity inspection",
    ],
  },
];

import { MOCK_CUSTOMER_ACTIVITY, MOCK_CUSTOMER_REQUESTS } from "./core-data";
import type {
  MockAiPrompt,
  MockAiRecommendation,
  MockDashboardAlert,
  MockDashboardMetric,
  MockDashboardTask,
} from "./types";

export interface MockDashboardPack {
  heading: string;
  subheading: string;
  metrics: MockDashboardMetric[];
  tasks: MockDashboardTask[];
  alerts: MockDashboardAlert[];
  aiPrompts: MockAiPrompt[];
  aiRecommendations: MockAiRecommendation[];
}

const openRequests = MOCK_CUSTOMER_REQUESTS.filter(
  (item) => !["completed", "cancelled", "rejected"].includes(item.status),
);

export const MOCK_CUSTOMER_DASHBOARD_PACK: MockDashboardPack = {
  heading: "Customer Operations Overview",
  subheading: "Service health, active requests, and AI-guided next steps.",
  metrics: [
    {
      id: "customer-open",
      label: "Open Requests",
      value: String(openRequests.length),
      hint: "All active customer requests",
      delta: "+2 week-over-week",
      tone: "neutral",
    },
    {
      id: "customer-sla",
      label: "SLA On Track",
      value: "98%",
      hint: "Current month trend",
      delta: "+3% vs last month",
      tone: "good",
    },
    {
      id: "customer-risk",
      label: "At Risk",
      value: "2",
      hint: "Likely breach without intervention",
      delta: "-1 since yesterday",
      tone: "warn",
    },
    {
      id: "customer-messages",
      label: "Unread Messages",
      value: "7",
      hint: "Across partner threads",
      delta: "+1 last 12h",
      tone: "neutral",
    },
  ],
  tasks: [
    {
      id: "ct-1",
      title: "Approve Fiber Link rollback window",
      owner: "Customer IT",
      eta: "Today 18:00",
      status: "queued",
    },
    {
      id: "ct-2",
      title: "Review POS firmware exceptions",
      owner: "Service Desk",
      eta: "Tomorrow 11:00",
      status: "in_progress",
    },
  ],
  alerts: [
    {
      id: "ca-1",
      title: "REQ-1401 nearing SLA threshold",
      severity: "high",
      detail: "No completion evidence logged in last 14h.",
      source: "SLA predictor",
    },
  ],
  aiPrompts: [
    {
      id: "cp-1",
      prompt: "Summarize all urgent items and propose owners.",
      expectedOutcome: "Prioritized action list grouped by team.",
    },
    {
      id: "cp-2",
      prompt: "Draft a client update for all in-progress requests.",
      expectedOutcome: "Share-ready status update message.",
    },
  ],
  aiRecommendations: [
    {
      id: "cr-1",
      title: "Escalate REQ-1401 to night shift coordinator",
      reason: "Delivery proof missing and risk score rose to 0.81.",
      confidence: 0.81,
      action: "Create escalation task + notify logistics lead",
      linkedEntity: "REQ-1401",
    },
  ],
};

export const MOCK_PARTNER_DASHBOARD_PACK: MockDashboardPack = {
  heading: "Partner Delivery Board",
  subheading: "Assigned queue, execution quality, and escalation posture.",
  metrics: [
    {
      id: "partner-assigned",
      label: "Assigned",
      value: "24",
      hint: "Current queue",
      delta: "+4 today",
      tone: "neutral",
    },
    {
      id: "partner-progress",
      label: "In Progress",
      value: "9",
      hint: "Active jobs",
      delta: "steady",
      tone: "neutral",
    },
    {
      id: "partner-sla",
      label: "SLA Risk",
      value: "3",
      hint: "Need intervention",
      delta: "-1 in 24h",
      tone: "warn",
    },
    {
      id: "partner-delivered",
      label: "Delivered",
      value: "41",
      hint: "Last 30 days",
      delta: "+6 vs prior period",
      tone: "good",
    },
  ],
  tasks: [
    {
      id: "pt-1",
      title: "Upload proof for shipment SHP-3382",
      owner: "Field Engineer Pod A",
      eta: "Today 17:30",
      status: "in_progress",
    },
    {
      id: "pt-2",
      title: "Confirm carrier reassignment for REQ-1407",
      owner: "Partner Ops",
      eta: "Today 15:00",
      status: "blocked",
    },
  ],
  alerts: [
    {
      id: "pa-1",
      title: "Carrier SLA drift detected",
      severity: "medium",
      detail: "Transit updates delayed for 2 active routes.",
      source: "Realtime monitor",
    },
  ],
  aiPrompts: [
    {
      id: "pp-1",
      prompt: "Show me all jobs likely to miss SLA in next 6h.",
      expectedOutcome: "Risk-ranked queue with recommended actions.",
    },
  ],
  aiRecommendations: [
    {
      id: "pr-1",
      title: "Reassign two Bay C calibration jobs",
      reason: "Current assignee load exceeds safe threshold by 35%.",
      confidence: 0.77,
      action: "Move jobs to Pod B and notify customer",
      linkedEntity: "REQ-1404",
    },
  ],
};

export const MOCK_STAFF_DASHBOARD_PACK: MockDashboardPack = {
  heading: "Staff Command Center",
  subheading: "Cross-functional workload between sales, ops, and support.",
  metrics: [
    {
      id: "staff-incidents",
      label: "Open Incidents",
      value: "7",
      hint: "Cross-team blockers",
      delta: "-2 since yesterday",
      tone: "warn",
    },
    {
      id: "staff-orders",
      label: "Orders Today",
      value: "36",
      hint: "Validated intake",
      delta: "+8 day-over-day",
      tone: "good",
    },
    {
      id: "staff-shipments",
      label: "Shipments Active",
      value: "22",
      hint: "In transit",
      delta: "+3 since morning",
      tone: "neutral",
    },
    {
      id: "staff-breaches",
      label: "SLA Breaches",
      value: "1",
      hint: "Needs intervention",
      delta: "no change",
      tone: "critical",
    },
  ],
  tasks: [
    {
      id: "st-1",
      title: "Resolve invoice validation mismatch INV-2201",
      owner: "Finance Ops",
      eta: "Today 16:00",
      status: "blocked",
    },
    {
      id: "st-2",
      title: "Confirm sales to logistics handoff WKO-982",
      owner: "Fulfilment Coordinator",
      eta: "Today 14:30",
      status: "queued",
    },
  ],
  alerts: [
    {
      id: "sa-1",
      title: "Workflow transition loop detected",
      severity: "high",
      detail: "Order ORD-4402 moved between review and triage 4 times.",
      source: "Anomaly detector",
    },
  ],
  aiPrompts: [
    {
      id: "sp-1",
      prompt: "Generate an end-of-day operational digest.",
      expectedOutcome: "Summary by team with blockers and owners.",
    },
  ],
  aiRecommendations: [
    {
      id: "sr-1",
      title: "Trigger proactive customer update for delayed shipment",
      reason: "Delay probability crossed 0.74 and no recent outbound message.",
      confidence: 0.74,
      action: "Send templated update and attach ETA",
      linkedEntity: "SHP-3382",
    },
  ],
};

export const MOCK_ADMIN_DASHBOARD_PACK: MockDashboardPack = {
  heading: "Admin Governance Console",
  subheading: "Security posture, policy drift, and automation reliability.",
  metrics: [
    {
      id: "admin-users",
      label: "Active Users",
      value: "126",
      hint: "Signed in last 30 days",
      delta: "+5 this week",
      tone: "neutral",
    },
    {
      id: "admin-critical",
      label: "Critical Alerts",
      value: "1",
      hint: "Security events",
      delta: "-2 since patch window",
      tone: "critical",
    },
    {
      id: "admin-drift",
      label: "Policy Drift",
      value: "3",
      hint: "Requires admin review",
      delta: "-1 after approvals",
      tone: "warn",
    },
    {
      id: "admin-auto",
      label: "Automations",
      value: "27",
      hint: "Workflow rules active",
      delta: "+4 this sprint",
      tone: "good",
    },
  ],
  tasks: [
    {
      id: "at-1",
      title: "Approve new escalation policy for logistics",
      owner: "Platform Admin",
      eta: "Tomorrow 09:00",
      status: "queued",
    },
    {
      id: "at-2",
      title: "Review RBAC anomaly event AUD-9032",
      owner: "Security Lead",
      eta: "Today 13:00",
      status: "in_progress",
    },
  ],
  alerts: [
    {
      id: "aa-1",
      title: "Potential over-privileged role assignment",
      severity: "critical",
      detail: "Temporary operator role has admin workflow publish permission.",
      source: "Audit log explorer",
    },
  ],
  aiPrompts: [
    {
      id: "ap-1",
      prompt: "Explain this week policy drift by domain.",
      expectedOutcome: "Narrative summary with impacted workflows.",
    },
  ],
  aiRecommendations: [
    {
      id: "ar-1",
      title: "Pause automation flow AUTO-11 until policy update",
      reason: "Flow can execute without new approval gate in phase 4 policy.",
      confidence: 0.89,
      action: "Pause flow and open governance review task",
      linkedEntity: "AUTO-11",
    },
  ],
};

export const MOCK_SALES_DASHBOARD_PACK: MockDashboardPack = {
  heading: "Sales Engine Snapshot",
  subheading: "Pipeline health, invoice conversion, and order throughput.",
  metrics: [
    {
      id: "sales-orders",
      label: "Orders in Pipeline",
      value: "58",
      hint: "Current lifecycle volume",
      delta: "+11 this week",
      tone: "good",
    },
    {
      id: "sales-invoices",
      label: "Invoice Conversion",
      value: "92%",
      hint: "Order to invoice ratio",
      delta: "+2% month-over-month",
      tone: "good",
    },
    {
      id: "sales-stale",
      label: "Stale Work Orders",
      value: "4",
      hint: "No update in 48h",
      delta: "-1 in 24h",
      tone: "warn",
    },
    {
      id: "sales-risk",
      label: "Revenue At Risk",
      value: "R 1.4M",
      hint: "If unresolved this cycle",
      delta: "R 0.2M down",
      tone: "critical",
    },
  ],
  tasks: [],
  alerts: [],
  aiPrompts: [],
  aiRecommendations: [],
};

export const MOCK_LOGISTICS_DASHBOARD_PACK: MockDashboardPack = {
  heading: "Logistics Engine Snapshot",
  subheading: "Carrier performance, delivery risk, and proof compliance.",
  metrics: [
    {
      id: "logistics-transit",
      label: "In Transit",
      value: "22",
      hint: "Active shipments",
      delta: "+3 today",
      tone: "neutral",
    },
    {
      id: "logistics-on-time",
      label: "On-Time Rate",
      value: "94%",
      hint: "Last 30 days",
      delta: "+1.2%",
      tone: "good",
    },
    {
      id: "logistics-pod",
      label: "Missing POD",
      value: "2",
      hint: "Delivered without proof",
      delta: "-1 since morning",
      tone: "warn",
    },
    {
      id: "logistics-exceptions",
      label: "Route Exceptions",
      value: "5",
      hint: "Delayed/blocked routes",
      delta: "+2",
      tone: "critical",
    },
  ],
  tasks: [],
  alerts: [],
  aiPrompts: [],
  aiRecommendations: [],
};

export const MOCK_CUSTOMER_ACTIVITY_FEED = MOCK_CUSTOMER_ACTIVITY;

import type {
  MockDocument,
  MockMessage,
  MockRequest,
  MockTimelineEvent,
  MockUser,
} from "./types";

export const MOCK_CUSTOMER_ID = "cust-001";
export const MOCK_PARTNER_ID = "partner-019";
export const MOCK_ROLE_ORDER = [
  "customer",
  "partner",
  "staff",
  "admin",
] as const;
export const MOCK_REQUEST_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export const MOCK_PORTAL_LINKS = [
  { label: "Customer", href: "/customer/requests" },
  { label: "Partner", href: "/partner/dashboard" },
] as const;

export const MOCK_LOGIN_CREDENTIALS = [
  {
    role: "customer" as const,
    email: "customer.demo@blubook.co.za",
    password: "DemoPass123!",
    home: "/customer/requests",
  },
  {
    role: "partner" as const,
    email: "partner.finance@blubook.co.za",
    password: "DemoPass123!",
    home: "/partner/dashboard",
    suite: "finance",
  },
  {
    role: "partner" as const,
    email: "partner.sales@blubook.co.za",
    password: "DemoPass123!",
    home: "/partner/dashboard",
    suite: "sales_ops",
  },
  {
    role: "partner" as const,
    email: "partner.marketing@blubook.co.za",
    password: "DemoPass123!",
    home: "/partner/dashboard",
    suite: "marketing",
  },
  {
    role: "partner" as const,
    email: "partner.legal@blubook.co.za",
    password: "DemoPass123!",
    home: "/partner/dashboard",
    suite: "legal",
  },
  {
    role: "partner" as const,
    email: "partner.hr@blubook.co.za",
    password: "DemoPass123!",
    home: "/partner/dashboard",
    suite: "hr",
  },
] as const;

export const MOCK_SUITE_OWNERS = [
  { suite: "finance", owner: "Finance Partner" },
  { suite: "sales_ops", owner: "Sales Ops Partner" },
  { suite: "marketing", owner: "Marketing Partner" },
  { suite: "legal", owner: "Legal Partner" },
  { suite: "hr", owner: "HR Partner" },
] as const;

export const MOCK_CUSTOMER_REQUESTS: MockRequest[] = [
  {
    id: "REQ-1401",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "Fiber Link Upgrade - Johannesburg HQ",
    description:
      "Upgrade primary uplink from 500Mbps to 1Gbps with after-hours cutover and rollback validation.",
    status: "in_progress",
    priority: "urgent",
    created_at: "2026-05-15T09:12:00.000Z",
    updated_at: "2026-05-28T13:45:00.000Z",
  },
  {
    id: "REQ-1402",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "POS Terminal Firmware Rollout",
    description:
      "Roll firmware v4.8.2 to all branch devices and provide sign-off report per store cluster.",
    status: "review",
    priority: "high",
    created_at: "2026-05-12T08:00:00.000Z",
    updated_at: "2026-05-28T09:24:00.000Z",
  },
  {
    id: "REQ-1403",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "Monthly Security Patch Window",
    description:
      "Patch endpoint fleet and back-office servers, then submit compliance artifacts.",
    status: "completed",
    priority: "medium",
    created_at: "2026-05-02T07:35:00.000Z",
    updated_at: "2026-05-21T17:03:00.000Z",
  },
  {
    id: "REQ-1404",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "Warehouse Scanner Calibration",
    description:
      "Recalibrate scanning tunnels to fix barcode read failures on inbound pallets.",
    status: "triaged",
    priority: "medium",
    created_at: "2026-05-23T10:16:00.000Z",
    updated_at: "2026-05-29T02:20:00.000Z",
  },
  {
    id: "REQ-1405",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "API Gateway Certificate Rotation",
    description:
      "Rotate expiring TLS certificates for public APIs and validate partner callbacks.",
    status: "submitted",
    priority: "high",
    created_at: "2026-05-28T06:44:00.000Z",
    updated_at: "2026-05-28T06:44:00.000Z",
  },
  {
    id: "REQ-1406",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "Legacy CRM Data Cleanup",
    description:
      "Remove duplicate contact records and merge account hierarchies before migration.",
    status: "cancelled",
    priority: "low",
    created_at: "2026-04-18T11:22:00.000Z",
    updated_at: "2026-04-20T15:49:00.000Z",
  },
  {
    id: "REQ-1407",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "Retail Kiosk Camera Diagnostics",
    description:
      "Investigate intermittent stream dropouts and replace defective camera units.",
    status: "in_progress",
    priority: "high",
    created_at: "2026-05-20T13:10:00.000Z",
    updated_at: "2026-05-29T01:05:00.000Z",
  },
  {
    id: "REQ-1408",
    customer_id: MOCK_CUSTOMER_ID,
    partner_id: MOCK_PARTNER_ID,
    title: "Branch UPS Battery Swap",
    description:
      "Replace degraded UPS banks at top 10 risk branches and run runtime test logs.",
    status: "rejected",
    priority: "medium",
    created_at: "2026-05-06T09:30:00.000Z",
    updated_at: "2026-05-07T10:18:00.000Z",
  },
];

export const MOCK_REQUEST_MESSAGES: Record<string, MockMessage[]> = {
  "REQ-1401": [
    {
      id: "MSG-9101",
      request_id: "REQ-1401",
      sender_id: MOCK_PARTNER_ID,
      sender_name: "Partner Ops",
      body: "Night-window booked for Saturday 23:00. Cutover runbook shared in docs.",
      created_at: "2026-05-27T18:22:00.000Z",
    },
    {
      id: "MSG-9102",
      request_id: "REQ-1401",
      sender_id: MOCK_CUSTOMER_ID,
      sender_name: "Customer IT",
      body: "Approved. Please include rollback checkpoint at T+45 minutes.",
      created_at: "2026-05-27T18:29:00.000Z",
    },
  ],
  "REQ-1402": [
    {
      id: "MSG-9103",
      request_id: "REQ-1402",
      sender_id: MOCK_PARTNER_ID,
      sender_name: "Field Engineer",
      body: "92% rollout complete, waiting on two store devices that are offline.",
      created_at: "2026-05-28T08:58:00.000Z",
    },
  ],
  "REQ-1404": [
    {
      id: "MSG-9104",
      request_id: "REQ-1404",
      sender_id: MOCK_CUSTOMER_ID,
      sender_name: "Warehouse Lead",
      body: "Please prioritize Bay C and D first, they have the highest volume.",
      created_at: "2026-05-29T02:25:00.000Z",
    },
  ],
};

export const MOCK_CUSTOMER_DOCUMENTS: MockDocument[] = [
  {
    path: "customers/cust-001/contracts/master-service-agreement-v3.pdf",
    name: "master-service-agreement-v3.pdf",
    size: 2389440,
    updatedAt: "2026-05-24T14:10:00.000Z",
  },
  {
    path: "customers/cust-001/sla/sla-scorecard-april-2026.xlsx",
    name: "sla-scorecard-april-2026.xlsx",
    size: 489220,
    updatedAt: "2026-05-26T10:41:00.000Z",
  },
  {
    path: "customers/cust-001/compliance/security-patch-proof-2026-05.pdf",
    name: "security-patch-proof-2026-05.pdf",
    size: 1185330,
    updatedAt: "2026-05-21T17:15:00.000Z",
  },
];

export const MOCK_PARTNER_DOCUMENTS: MockDocument[] = [
  {
    path: "partners/partner-019/pod/pod-batch-112.zip",
    name: "pod-batch-112.zip",
    size: 7451200,
    updatedAt: "2026-05-27T16:04:00.000Z",
  },
  {
    path: "partners/partner-019/evidence/installation-photos-q2.tar",
    name: "installation-photos-q2.tar",
    size: 25300120,
    updatedAt: "2026-05-28T09:12:00.000Z",
  },
  {
    path: "partners/partner-019/reports/throughput-benchmark-week-21.csv",
    name: "throughput-benchmark-week-21.csv",
    size: 95400,
    updatedAt: "2026-05-29T00:42:00.000Z",
  },
];

export const MOCK_CUSTOMER_ACTIVITY = [
  "REQ-1401 moved to In Progress after partner acceptance.",
  "New compliance document uploaded: security-patch-proof-2026-05.pdf.",
  "POS Firmware rollout entered customer review cycle.",
  "SLA health score improved by 3% this week.",
  "Two high-priority requests assigned to Partner Ops pod A.",
];

export const buildMockRequestTimeline = (
  request?: MockRequest,
): MockTimelineEvent[] => {
  if (!request) {
    return [];
  }

  const timeline: MockTimelineEvent[] = [
    {
      label: "Request created",
      at: request.created_at,
      tone: "neutral",
    },
    {
      label: `Status updated to ${request.status.replaceAll("_", " ")}`,
      at: request.updated_at,
      tone: "accent",
    },
  ];

  return timeline.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
};

export const MOCK_USERS: MockUser[] = [
  {
    id: "USR-1001",
    fullName: "Thandi Mokoena",
    email: "thandi.mokoena@blubook.co.za",
    role: "admin",
    status: "active",
    department: "Platform Governance",
    lastSeenAt: "2026-06-01T07:42:00.000Z",
  },
  {
    id: "USR-1002",
    fullName: "Aiden Naidoo",
    email: "aiden.naidoo@blubook.co.za",
    role: "admin",
    status: "active",
    department: "Security",
    lastSeenAt: "2026-06-01T07:20:00.000Z",
  },
  {
    id: "USR-1003",
    fullName: "Naledi Khumalo",
    email: "naledi.khumalo@blubook.co.za",
    role: "staff",
    status: "active",
    department: "Operations",
    lastSeenAt: "2026-06-01T06:58:00.000Z",
  },
  {
    id: "USR-1004",
    fullName: "Jason Meyer",
    email: "jason.meyer@blubook.co.za",
    role: "staff",
    status: "active",
    department: "Customer Success",
    lastSeenAt: "2026-06-01T06:40:00.000Z",
  },
  {
    id: "USR-1005",
    fullName: "Amina Patel",
    email: "amina.patel@blubook.co.za",
    role: "partner",
    status: "active",
    department: "Partner Operations",
    lastSeenAt: "2026-06-01T06:12:00.000Z",
  },
  {
    id: "USR-1006",
    fullName: "Lebo Sithole",
    email: "lebo.sithole@blubook.co.za",
    role: "partner",
    status: "invited",
    department: "Field Services",
    lastSeenAt: "2026-05-31T15:02:00.000Z",
  },
  {
    id: "USR-1007",
    fullName: "Priya Govender",
    email: "priya.govender@blubook.co.za",
    role: "customer",
    status: "active",
    department: "Retail IT",
    lastSeenAt: "2026-06-01T07:01:00.000Z",
  },
  {
    id: "USR-1008",
    fullName: "Kagiso Molefe",
    email: "kagiso.molefe@blubook.co.za",
    role: "customer",
    status: "active",
    department: "Distribution",
    lastSeenAt: "2026-06-01T05:44:00.000Z",
  },
  {
    id: "USR-1009",
    fullName: "Zara Jacobs",
    email: "zara.jacobs@blubook.co.za",
    role: "staff",
    status: "suspended",
    department: "Operations",
    lastSeenAt: "2026-05-29T16:19:00.000Z",
  },
  {
    id: "USR-1010",
    fullName: "Sizwe Dlamini",
    email: "sizwe.dlamini@blubook.co.za",
    role: "partner",
    status: "active",
    department: "Logistics Coordination",
    lastSeenAt: "2026-06-01T06:28:00.000Z",
  },
];

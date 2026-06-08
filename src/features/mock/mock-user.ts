import type {
  MockUser,
} from "./types";

export const MOCK_ADMIN_ROLES = [
  {
    id: "ROLE-ADMIN",
    name: "admin",
    description: "Full system access including user and role management",
  },
  {
    id: "ROLE-STAFF",
    name: "staff",
    description: "Internal operations staff with limited access",
  },
  {
    id: "ROLE-PARTNER",
    name: "partner",
    description: "External service providers managing assigned work",
  },
  {
    id: "ROLE-CUSTOMER",
    name: "customer",
    description: "External clients with request-only access",
  },
] as const;

export const MOCK_ADMIN_PERMISSIONS = [
  { key: "users.create", label: "Create Users" },
  { key: "users.edit", label: "Edit Users" },
  { key: "users.delete", label: "Delete Users" },
  { key: "users.view", label: "View Users" },

  { key: "roles.create", label: "Create Roles" },
  { key: "roles.edit", label: "Edit Roles" },
  { key: "roles.delete", label: "Delete Roles" },
  { key: "roles.assign", label: "Assign Roles" },

  { key: "requests.view", label: "View Requests" },
  { key: "requests.manage", label: "Manage Requests" },

  { key: "documents.view", label: "View Documents" },
  { key: "documents.upload", label: "Upload Documents" },

  { key: "system.audit", label: "View Audit Logs" },
] as const;

export const MOCK_ROLE_PERMISSION_MAP = {
  admin: [
    "users.create",
    "users.edit",
    "users.delete",
    "users.view",
    "roles.create",
    "roles.edit",
    "roles.delete",
    "roles.assign",
    "requests.view",
    "requests.manage",
    "documents.view",
    "documents.upload",
    "system.audit",
  ],

  staff: [
    "users.view",
    "requests.view",
    "requests.manage",
    "documents.view",
  ],

  partner: [
    "requests.view",
    "documents.view",
    "documents.upload",
  ],

  customer: [
    "requests.view",
  ],
} as const;

export const MOCK_ADMIN_AUDIT_LOGS = [
  {
    id: "AUD-1001",
    actor: "Thandi Mokoena",
    action: "ROLE_UPDATED",
    target: "staff",
    description: "Updated staff role permissions (added requests.manage)",
    timestamp: "2026-06-01T08:10:00.000Z",
  },
  {
    id: "AUD-1002",
    actor: "Aiden Naidoo",
    action: "USER_CREATED",
    target: "Sizwe Dlamini",
    description: "Created new partner user account",
    timestamp: "2026-06-01T07:55:00.000Z",
  },
  {
    id: "AUD-1003",
    actor: "Thandi Mokoena",
    action: "USER_ROLE_CHANGED",
    target: "Zara Jacobs",
    description: "Changed role from staff → suspended",
    timestamp: "2026-05-29T16:20:00.000Z",
  },
  {
    id: "AUD-1004",
    actor: "Aiden Naidoo",
    action: "PERMISSION_GRANTED",
    target: "partner",
    description: "Granted documents.upload permission to partner role",
    timestamp: "2026-05-28T10:05:00.000Z",
  },
] as const;

export const MOCK_USER_ROLE_ASSIGNMENTS: Record<
  string,
  { userId: string; role: string }
> = {
  "USR-1001": { userId: "USR-1001", role: "admin" },
  "USR-1002": { userId: "USR-1002", role: "admin" },
  "USR-1003": { userId: "USR-1003", role: "staff" },
  "USR-1004": { userId: "USR-1004", role: "staff" },
  "USR-1005": { userId: "USR-1005", role: "partner" },
  "USR-1006": { userId: "USR-1006", role: "partner" },
  "USR-1007": { userId: "USR-1007", role: "customer" },
  "USR-1008": { userId: "USR-1008", role: "customer" },
  "USR-1009": { userId: "USR-1009", role: "staff" },
  "USR-1010": { userId: "USR-1010", role: "partner" },
} as const;

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
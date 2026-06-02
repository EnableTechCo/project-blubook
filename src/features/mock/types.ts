export type MockRequestStatus =
  | "submitted"
  | "triaged"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled"
  | "rejected";

export type MockRequestPriority = "low" | "medium" | "high" | "urgent";

export interface MockRequest {
  id: string;
  customer_id: string;
  partner_id: string;
  title: string;
  description: string;
  status: MockRequestStatus;
  priority: MockRequestPriority;
  created_at: string;
  updated_at: string;
}

export interface MockMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface MockDocument {
  path: string;
  name: string;
  size: number;
  updatedAt: string;
}

export type MockUserRole = "customer" | "partner" | "staff" | "admin";
export type MockUserStatus = "invited" | "active" | "suspended";

export interface MockUser {
  id: string;
  fullName: string;
  email: string;
  role: MockUserRole;
  status: MockUserStatus;
  department: string;
  lastSeenAt: string;
}

export interface MockWorkspaceMetric {
  label: string;
  value: string;
  hint: string;
}

export interface MockWorkspaceStream {
  title: string;
  items: string[];
}

export interface MockWorkspaceData {
  phase: string;
  title: string;
  subtitle: string;
  metrics: MockWorkspaceMetric[];
  streams: MockWorkspaceStream[];
}

export interface MockTimelineEvent {
  label: string;
  at: string;
  tone: "neutral" | "accent";
}

export type MockMetricTone = "neutral" | "good" | "warn" | "critical";

export interface MockDashboardMetric {
  id: string;
  label: string;
  value: string;
  hint: string;
  delta?: string;
  tone?: MockMetricTone;
}

export interface MockDashboardTask {
  id: string;
  title: string;
  owner: string;
  eta: string;
  status: "queued" | "in_progress" | "blocked" | "completed";
}

export interface MockDashboardAlert {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
  source: string;
}

export interface MockAiRecommendation {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  action: string;
  linkedEntity?: string;
}

export interface MockAiAutomation {
  id: string;
  name: string;
  trigger: string;
  steps: string[];
  status: "active" | "paused" | "draft";
  impact: string;
}

export interface MockAiPrompt {
  id: string;
  prompt: string;
  expectedOutcome: string;
}

import type {
  MockAiAutomation,
  MockAiPrompt,
  MockAiRecommendation,
} from "./types";

export interface MockAiScenario {
  id: string;
  name: string;
  phase: "Phase 2" | "Phase 3" | "Phase 4" | "Phase 5";
  trigger: string;
  expectedOutcome: string;
  dataPoints: string[];
  automationId?: string;
}

export const MOCK_AI_AUTOMATIONS: MockAiAutomation[] = [
  {
    id: "AUTO-11",
    name: "SLA Risk Escalation",
    trigger: "Request risk score > 0.75 for 30 minutes",
    steps: [
      "Create escalation task",
      "Notify owner and backup owner",
      "Post summary to partner thread",
      "Log action in audit stream",
    ],
    status: "active",
    impact: "Average 22% reduction in breaches for high-priority requests.",
  },
  {
    id: "AUTO-14",
    name: "Delivery Proof Follow-up",
    trigger: "Shipment marked delivered without proof",
    steps: [
      "Trigger partner reminder",
      "Open missing POD queue item",
      "Escalate to logistics lead after 2 hours",
    ],
    status: "active",
    impact: "Reduced missing proof backlog by 34% in pilot data.",
  },
  {
    id: "AUTO-19",
    name: "Policy Drift Guardrail",
    trigger: "Workflow rule edited without mandatory approval",
    steps: [
      "Pause affected automation",
      "Request governance approval",
      "Capture audit note with change delta",
    ],
    status: "draft",
    impact: "Prevents non-compliant workflow execution in regulated flows.",
  },
];

export const MOCK_AI_RECOMMENDATION_BACKLOG: MockAiRecommendation[] = [
  {
    id: "AIR-1",
    title: "Escalate REQ-1401 to night coordinator",
    reason: "Customer response latency increased while risk trend climbed.",
    confidence: 0.81,
    action: "Assign escalation and send customer ETA update",
    linkedEntity: "REQ-1401",
  },
  {
    id: "AIR-2",
    title: "Reassign SHP-3382 to alternate carrier",
    reason: "Route reliability score dropped below 0.6.",
    confidence: 0.76,
    action: "Swap carrier and notify partner inbox",
    linkedEntity: "SHP-3382",
  },
  {
    id: "AIR-3",
    title: "Pause AUTO-11 until policy v4.2 approval",
    reason: "Approval gate mismatch detected in governance rules.",
    confidence: 0.89,
    action: "Pause flow and open admin review",
    linkedEntity: "AUTO-11",
  },
];

export const MOCK_AI_CHATBOT_PROMPTS: MockAiPrompt[] = [
  {
    id: "AIP-1",
    prompt: "What are my top SLA risks in the next 6 hours?",
    expectedOutcome: "A ranked list with reasons and escalation options.",
  },
  {
    id: "AIP-2",
    prompt: "Summarize all partner delivery blockers for today's standup.",
    expectedOutcome: "Concise summary grouped by owner and ETA.",
  },
  {
    id: "AIP-3",
    prompt:
      "Draft a status update for delayed shipments for customer accounts.",
    expectedOutcome: "Role-safe message draft with shipment IDs and ETAs.",
  },
];

export const MOCK_AI_SCENARIOS: MockAiScenario[] = [
  {
    id: "AIS-1",
    name: "Proactive SLA rescue",
    phase: "Phase 3",
    trigger: "Order and shipment delay signals cross threshold",
    expectedOutcome: "Escalation tasks created before SLA breach",
    dataPoints: [
      "request.updated_at",
      "message.response_latency",
      "shipment.route_status",
      "assignee.current_load",
    ],
    automationId: "AUTO-11",
  },
  {
    id: "AIS-2",
    name: "Proof of delivery recovery",
    phase: "Phase 3",
    trigger: "Delivered shipment lacks proof file",
    expectedOutcome: "Proof uploaded within escalation SLA",
    dataPoints: [
      "shipment.status",
      "document.upload_events",
      "partner.message_threads",
    ],
    automationId: "AUTO-14",
  },
  {
    id: "AIS-3",
    name: "Governance drift prevention",
    phase: "Phase 4",
    trigger: "Workflow edit bypasses mandatory approval",
    expectedOutcome: "Automation paused and admin notified",
    dataPoints: [
      "admin.workflow_change_log",
      "role.permission_matrix",
      "audit.policy_version",
    ],
    automationId: "AUTO-19",
  },
];

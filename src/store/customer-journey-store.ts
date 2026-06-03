import { create } from "zustand";

export type PackageTier = "bronze" | "silver" | "premium";
export type CorporateSuite =
  | "finance"
  | "sales_ops"
  | "marketing"
  | "legal"
  | "hr";

export interface SuiteRequest {
  id: string;
  suite: CorporateSuite;
  title: string;
  status:
    | "pending_partner_review"
    | "pending_customer_docs"
    | "waiting_purchase_order"
    | "in_progress"
    | "completed"
    | "rejected";
  partnerDecision: "pending" | "accepted" | "rejected";
  serviceOfferings: string[];
  requiredDocs: string[];
  receivedDocs: string[];
  poRequired: boolean;
  slaTargetHours: number;
  slaDueAt: string | null;
  priority: "medium" | "high";
}

export interface JourneyNotification {
  id: string;
  source: CorporateSuite | "system" | "sales_ops" | "logistics";
  message: string;
  createdAt: string;
  read: boolean;
}

export interface OnboardingSnapshot {
  businessTitle: string;
  businessSummary: string;
  companyType: "llc" | "corporation" | "partnership";
  employees: "1-20" | "21-49" | "50+";
  country: string;
  city: string;
  inventoryHandling: "in_house" | "third_party" | "none";
  regions: Array<"domestic" | "cross_border">;
  regulated: boolean;
  submittedAt: string;
}

interface CustomerJourneyState {
  packageTier: PackageTier | null;
  paid: boolean;
  onboardingCompleted: boolean;
  poUploaded: boolean;
  poReference: string;
  salesStage: string;
  logisticsStage: string;
  onboardingSnapshot: OnboardingSnapshot | null;
  suiteRequests: SuiteRequest[];
  viewedSuiteRequestIds: string[];
  notifications: JourneyNotification[];
  partnerNotifications: JourneyNotification[];
  selectPackage: (tier: PackageTier) => void;
  completePayment: () => void;
  completeOnboarding: (snapshot: OnboardingSnapshot) => void;
  uploadSuiteDocument: (requestId: string, docName: string) => void;
  uploadPurchaseOrder: (poReference: string) => void;
  reviewSuiteRequest: (
    requestId: string,
    decision: "accepted" | "rejected",
  ) => void;
  advanceSalesWorkflow: () => void;
  advanceLogisticsWorkflow: () => void;
  remindSuiteDocument: (suite: CorporateSuite, docName: string) => void;
  markSuiteRequestViewed: (requestId: string) => void;
  markNotificationRead: (id: string) => void;
  markPartnerNotificationRead: (id: string) => void;
}

const SALES_STAGES = [
  "PO Received",
  "Order Validated",
  "Work Order Created",
  "Inventory Confirmed",
  "Invoice Prepared",
  "Ready for Logistics",
] as const;

const LOGISTICS_STAGES = [
  "Order Received",
  "Warehouse Assigned",
  "Carrier Assigned",
  "In Transit",
  "Delivered",
] as const;

function formatSuiteLabel(suite: CorporateSuite): string {
  if (suite === "sales_ops") {
    return "Sales Ops";
  }

  if (suite === "hr") {
    return "HR";
  }

  return suite.charAt(0).toUpperCase() + suite.slice(1);
}

function addHoursIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

interface SuiteBlueprint {
  serviceOfferings: string[];
  poRequired: boolean;
  slaTargetHours: number;
  requiredDocsByTier: Record<PackageTier, string[]>;
}

const SUITE_BLUEPRINTS: Record<CorporateSuite, SuiteBlueprint> = {
  finance: {
    serviceOfferings: [
      "Bookkeeping and monthly close",
      "Reconciliation and management reporting",
      "Cash flow and burn tracking",
    ],
    poRequired: true,
    slaTargetHours: 72,
    requiredDocsByTier: {
      bronze: [
        "Corporate registration certificate",
        "Bank statements (last 3 months)",
        "Sales ledger export",
      ],
      silver: [
        "Corporate registration certificate",
        "Bank statements (last 6 months)",
        "Sales ledger export",
        "Expense receipts batch",
      ],
      premium: [
        "Corporate registration certificate",
        "Bank statements (last 12 months)",
        "Sales ledger export",
        "Expense receipts batch",
        "Tax profile and VAT certificate",
      ],
    },
  },
  sales_ops: {
    serviceOfferings: [
      "Order intake and validation",
      "Work-order orchestration",
      "Order-to-cash handoff",
    ],
    poRequired: true,
    slaTargetHours: 24,
    requiredDocsByTier: {
      bronze: ["Purchase order template", "Master SKU list"],
      silver: ["Purchase order template", "Master SKU list", "Pricing matrix"],
      premium: [
        "Purchase order template",
        "Master SKU list",
        "Pricing matrix",
        "Approval matrix",
      ],
    },
  },
  marketing: {
    serviceOfferings: [
      "Campaign planning and execution",
      "Creative and asset production workflow",
      "Marketing analytics and reporting",
    ],
    poRequired: false,
    slaTargetHours: 48,
    requiredDocsByTier: {
      bronze: [
        "Corporate identity overview",
        "Primary logo pack",
        "Brand color palette",
      ],
      silver: [
        "Corporate identity overview",
        "Primary and secondary logo pack",
        "Brand style guide",
        "Approved photo and video assets",
      ],
      premium: [
        "Corporate identity overview",
        "Primary and secondary logo pack",
        "Complete brand style guide",
        "Creative messaging framework",
        "Approved photo and video assets",
      ],
    },
  },
  legal: {
    serviceOfferings: [
      "Contract review and redlining",
      "Compliance calendar management",
      "Regulatory obligation tracking",
    ],
    poRequired: true,
    slaTargetHours: 72,
    requiredDocsByTier: {
      bronze: ["Entity registration", "Standard customer contract"],
      silver: [
        "Entity registration",
        "Standard customer contract",
        "Compliance policy summary",
      ],
      premium: [
        "Entity registration",
        "Standard customer contract",
        "Compliance policy pack",
        "Data protection and privacy policy",
      ],
    },
  },
  hr: {
    serviceOfferings: [
      "Employee onboarding operations",
      "Payroll operations support",
      "HR policy and case workflow administration",
    ],
    poRequired: true,
    slaTargetHours: 96,
    requiredDocsByTier: {
      bronze: ["Employee roster", "Employment contract template"],
      silver: [
        "Employee roster",
        "Employment contract template",
        "Payroll cycle file",
      ],
      premium: [
        "Employee roster",
        "Employment contract template",
        "Payroll cycle file",
        "HR policy and handbook",
      ],
    },
  },
};

function buildSuiteRequestsForTier(tier: PackageTier): SuiteRequest[] {
  return (Object.keys(SUITE_BLUEPRINTS) as CorporateSuite[]).map(
    (suite, index) => {
      const blueprint = SUITE_BLUEPRINTS[suite];

      return {
        id: `suite-${suite}`,
        suite,
        title: `${formatSuiteLabel(suite)} kickoff`,
        status: "pending_partner_review",
        partnerDecision: "pending",
        serviceOfferings: blueprint.serviceOfferings,
        requiredDocs: blueprint.requiredDocsByTier[tier],
        receivedDocs: [],
        poRequired: blueprint.poRequired,
        slaTargetHours: blueprint.slaTargetHours,
        slaDueAt: null,
        priority: index < 2 ? "high" : "medium",
      };
    },
  );
}

function newNotification(
  source: JourneyNotification["source"],
  message: string,
): JourneyNotification {
  return {
    id: `ntf-${Math.floor(Math.random() * 900000) + 100000}`,
    source,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

const DEFAULT_LOGIN_TIER: PackageTier = "premium";
const DEFAULT_LOGIN_SUITE_REQUESTS = buildSuiteRequestsForTier(
  DEFAULT_LOGIN_TIER,
).map((item) => ({
  ...item,
  partnerDecision: "accepted" as const,
  status: "pending_customer_docs" as const,
}));
const DEFAULT_LOGIN_NOTIFICATIONS: JourneyNotification[] = [
  newNotification(
    "system",
    "Welcome back. Your activated service providers have sent required document requests.",
  ),
  ...DEFAULT_LOGIN_SUITE_REQUESTS.map((request) =>
    newNotification(
      request.suite,
      `${formatSuiteLabel(request.suite)} requested: ${request.requiredDocs[0]}.`,
    ),
  ),
];

export const useCustomerJourneyStore = create<CustomerJourneyState>(
  (set, get) => ({
    packageTier: DEFAULT_LOGIN_TIER,
    paid: true,
    onboardingCompleted: true,
    poUploaded: false,
    poReference: "",
    salesStage: SALES_STAGES[0],
    logisticsStage: LOGISTICS_STAGES[0],
    onboardingSnapshot: {
      businessTitle: "BluBook Demo Customer",
      businessSummary:
        "Demo profile loaded for customer workspace walkthrough.",
      companyType: "llc",
      employees: "21-49",
      country: "South Africa",
      city: "Johannesburg",
      inventoryHandling: "in_house",
      regions: ["domestic"],
      regulated: false,
      submittedAt: new Date().toISOString(),
    },
    suiteRequests: DEFAULT_LOGIN_SUITE_REQUESTS,
    viewedSuiteRequestIds: [],
    notifications: DEFAULT_LOGIN_NOTIFICATIONS,
    partnerNotifications: [
      newNotification(
        "system",
        "Partner inbox seeded with five active suite queues for demo mode.",
      ),
    ],

    selectPackage: (tier) =>
      set(() => ({
        packageTier: tier,
        paid: false,
        onboardingCompleted: false,
        onboardingSnapshot: null,
        suiteRequests: [],
        viewedSuiteRequestIds: [],
        partnerNotifications: [],
        notifications: [
          newNotification(
            "system",
            `${tier.toUpperCase()} package selected. Complete payment to continue onboarding.`,
          ),
        ],
      })),

    completePayment: () =>
      set((state) => ({
        paid: true,
        notifications: [
          newNotification(
            "system",
            "Payment successful. Continue to onboarding form.",
          ),
          ...state.notifications,
        ],
      })),

    completeOnboarding: (snapshot) =>
      set((state) => {
        if (!state.packageTier) {
          return state;
        }

        const suiteRequests = buildSuiteRequestsForTier(state.packageTier);
        const suiteNotifications = suiteRequests.map((request) =>
          newNotification(
            request.suite,
            `${formatSuiteLabel(request.suite)} requested: ${request.requiredDocs[0]}. Partner review pending.`,
          ),
        );
        const partnerNotifications = suiteRequests.map((request) =>
          newNotification(
            request.suite,
            `New ${formatSuiteLabel(request.suite)} request received. Accept or reject to start execution.`,
          ),
        );

        return {
          onboardingCompleted: true,
          onboardingSnapshot: snapshot,
          suiteRequests,
          viewedSuiteRequestIds: [],
          partnerNotifications: [
            ...partnerNotifications,
            ...state.partnerNotifications,
          ],
          notifications: [
            newNotification(
              "system",
              "Onboarding submitted. All 5 corporate suites are now activated.",
            ),
            ...suiteNotifications,
            ...state.notifications,
          ],
        };
      }),

    uploadSuiteDocument: (requestId, docName) =>
      set((state) => {
        const partnerNotifications: JourneyNotification[] = [];
        const customerNotifications: JourneyNotification[] = [];

        const updated: SuiteRequest[] = state.suiteRequests.map(
          (request): SuiteRequest => {
            if (request.id !== requestId) {
              return request;
            }

            const receivedDocs = Array.from(
              new Set([...request.receivedDocs, docName]),
            );
            const completed = request.requiredDocs.every((doc) =>
              receivedDocs.includes(doc),
            );
            const canStartExecution =
              request.partnerDecision === "accepted" &&
              completed &&
              (!request.poRequired || state.poUploaded);
            const waitingForPo =
              request.partnerDecision === "accepted" &&
              completed &&
              request.poRequired &&
              !state.poUploaded;
            const nextStatus = canStartExecution
              ? "in_progress"
              : waitingForPo
                ? "waiting_purchase_order"
                : request.partnerDecision === "accepted"
                  ? "pending_customer_docs"
                  : request.status;
            const nextSlaDueAt = canStartExecution
              ? (request.slaDueAt ?? addHoursIso(request.slaTargetHours))
              : request.slaDueAt;

            partnerNotifications.push(
              newNotification(
                request.suite,
                `Customer uploaded ${docName} for ${formatSuiteLabel(request.suite)} request ${request.id}.`,
              ),
            );
            customerNotifications.push(
              newNotification(
                "system",
                `Document uploaded (${docName}). ${formatSuiteLabel(request.suite)} provider notified.`,
              ),
            );
            if (canStartExecution && nextSlaDueAt) {
              customerNotifications.push(
                newNotification(
                  request.suite,
                  `${formatSuiteLabel(request.suite)} started execution. SLA target due by ${new Date(nextSlaDueAt).toLocaleString()}.`,
                ),
              );
            }

            return {
              ...request,
              receivedDocs,
              status: nextStatus,
              slaDueAt: nextSlaDueAt,
            };
          },
        );

        return {
          suiteRequests: updated,
          notifications: [...customerNotifications, ...state.notifications],
          partnerNotifications: [
            ...partnerNotifications,
            ...state.partnerNotifications,
          ],
        };
      }),

    uploadPurchaseOrder: (poReference) =>
      set((state) => {
        const customerNotifications: JourneyNotification[] = [
          newNotification(
            "sales_ops",
            `Purchase order ${poReference} uploaded. Sales workflow started.`,
          ),
        ];
        const partnerNotifications: JourneyNotification[] = [
          newNotification(
            "sales_ops",
            `Customer uploaded PO ${poReference}. Continue partner intake for PO-bound suites.`,
          ),
        ];

        const suiteRequests: SuiteRequest[] = state.suiteRequests.map(
          (request): SuiteRequest => {
            const docsComplete = request.requiredDocs.every((doc) =>
              request.receivedDocs.includes(doc),
            );
            const canStart =
              request.partnerDecision === "accepted" &&
              request.poRequired &&
              docsComplete;

            if (!canStart) {
              return request;
            }

            const slaDueAt =
              request.slaDueAt ?? addHoursIso(request.slaTargetHours);
            customerNotifications.push(
              newNotification(
                request.suite,
                `${formatSuiteLabel(request.suite)} execution is active. SLA target due by ${new Date(slaDueAt).toLocaleString()}.`,
              ),
            );

            return {
              ...request,
              status: "in_progress",
              slaDueAt,
            };
          },
        );

        return {
          poUploaded: true,
          poReference,
          salesStage: SALES_STAGES[0],
          logisticsStage: LOGISTICS_STAGES[0],
          suiteRequests,
          notifications: [...customerNotifications, ...state.notifications],
          partnerNotifications: [
            ...partnerNotifications,
            ...state.partnerNotifications,
          ],
        };
      }),

    reviewSuiteRequest: (requestId, decision) =>
      set((state) => {
        const customerNotifications: JourneyNotification[] = [];
        const partnerNotifications: JourneyNotification[] = [];

        const suiteRequests: SuiteRequest[] = state.suiteRequests.map(
          (request): SuiteRequest => {
            if (request.id !== requestId) {
              return request;
            }

            if (decision === "rejected") {
              customerNotifications.push(
                newNotification(
                  request.suite,
                  `${formatSuiteLabel(request.suite)} provider rejected request ${request.id}. Team will follow up with alternatives.`,
                ),
              );

              return {
                ...request,
                partnerDecision: "rejected",
                status: "rejected",
                slaDueAt: null,
              };
            }

            const docsComplete = request.requiredDocs.every((doc) =>
              request.receivedDocs.includes(doc),
            );
            const canStart =
              docsComplete && (!request.poRequired || state.poUploaded);
            const waitingForPo =
              docsComplete && request.poRequired && !state.poUploaded;
            const nextStatus = canStart
              ? "in_progress"
              : waitingForPo
                ? "waiting_purchase_order"
                : "pending_customer_docs";
            const slaDueAt = canStart
              ? (request.slaDueAt ?? addHoursIso(request.slaTargetHours))
              : request.slaDueAt;

            partnerNotifications.push(
              newNotification(
                request.suite,
                `${formatSuiteLabel(request.suite)} accepted request ${request.id}. Required docs are already requested from customer.`,
              ),
            );
            customerNotifications.push(
              newNotification(
                request.suite,
                `${formatSuiteLabel(request.suite)} accepted your request. ${
                  nextStatus === "waiting_purchase_order"
                    ? "Upload purchase order to start execution."
                    : nextStatus === "in_progress"
                      ? `SLA target due by ${new Date(slaDueAt as string).toLocaleString()}.`
                      : "Finish required document uploads to start execution."
                }`,
              ),
            );

            return {
              ...request,
              partnerDecision: "accepted",
              status: nextStatus,
              slaDueAt,
            };
          },
        );

        return {
          suiteRequests,
          notifications: [...customerNotifications, ...state.notifications],
          partnerNotifications: [
            ...partnerNotifications,
            ...state.partnerNotifications,
          ],
        };
      }),

    advanceSalesWorkflow: () =>
      set((state) => {
        const current = SALES_STAGES.indexOf(
          state.salesStage as (typeof SALES_STAGES)[number],
        );
        const next = Math.min(current + 1, SALES_STAGES.length - 1);
        const nextStage = SALES_STAGES[next];
        const shouldTriggerLogistics = nextStage === "Ready for Logistics";

        return {
          salesStage: nextStage,
          notifications: [
            newNotification(
              "sales_ops",
              `Sales workflow moved to: ${nextStage}.`,
            ),
            ...(shouldTriggerLogistics
              ? [
                  newNotification(
                    "logistics",
                    "Sales handoff complete. Logistics workflow triggered.",
                  ),
                ]
              : []),
            ...state.notifications,
          ],
        };
      }),

    advanceLogisticsWorkflow: () =>
      set((state) => {
        const current = LOGISTICS_STAGES.indexOf(
          state.logisticsStage as (typeof LOGISTICS_STAGES)[number],
        );
        const next = Math.min(current + 1, LOGISTICS_STAGES.length - 1);
        const nextStage = LOGISTICS_STAGES[next];

        return {
          logisticsStage: nextStage,
          notifications: [
            newNotification(
              "logistics",
              `Logistics workflow moved to: ${nextStage}.`,
            ),
            ...state.notifications,
          ],
        };
      }),

    remindSuiteDocument: (suite, docName) =>
      set((state) => ({
        notifications: [
          newNotification(
            suite,
            `${formatSuiteLabel(suite)} requires document: ${docName}.`,
          ),
          ...state.notifications,
        ],
      })),

    markSuiteRequestViewed: (requestId) =>
      set((state) => ({
        viewedSuiteRequestIds: state.viewedSuiteRequestIds.includes(requestId)
          ? state.viewedSuiteRequestIds
          : [...state.viewedSuiteRequestIds, requestId],
      })),

    markNotificationRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      })),

    markPartnerNotificationRead: (id) =>
      set((state) => ({
        partnerNotifications: state.partnerNotifications.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      })),
  }),
);

export const SALES_WORKFLOW_STAGES = SALES_STAGES;
export const LOGISTICS_WORKFLOW_STAGES = LOGISTICS_STAGES;

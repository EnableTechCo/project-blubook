import { useMemo } from "react";

type PartnerDashboardPayload = {
  partner?: {
    offeredServiceStream?: string | null;
    isLogistics?: boolean;
  };
  requests?: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    packageId: string | null;
    packageTierCode: string | null;
    packageTierName: string | null;
    packageStream: string;
    requestStatus: "sent" | "acknowledged" | "failed";
    sentAt: string;
    acknowledgedAt: string | null;
    providerName: string | null;
    requiredDocsTotal: number;
    requiredDocsPending: number;
    aiReadiness: {
      status: "high" | "medium" | "low" | "insufficient_signal";
      label: string;
      score: number | null;
      confidence: number | null;
      reasons: string[];
      modelVersion: string | null;
      docsCompleteness: number;
    };
  }>;
  summary?: {
    total: number;
    sent: number;
    acknowledged: number;
    failed: number;
    pendingCustomerDocs: number;
    readyForExecution: number;
  };
  purchaseOrders?: unknown;
  logisticsWorkOrders?: unknown;
};

export function usePartnerDashboardData(
  payload: PartnerDashboardPayload | null,
) {
  return useMemo(() => {
    const summary = payload?.summary ?? {
      total: 0,
      sent: 0,
      acknowledged: 0,
      failed: 0,
      pendingCustomerDocs: 0,
      readyForExecution: 0,
    };

    const requests = payload?.requests ?? [];
    const newPings = requests.filter(
      (request) => request.requestStatus === "sent",
    );
    const acceptedRequests = requests.filter(
      (request) => request.requestStatus === "acknowledged",
    );

    const isLogisticsPartner =
      payload?.partner?.isLogistics ??
      (payload?.partner?.offeredServiceStream ?? "")
        .toLowerCase()
        .includes("logistics");

    return {
      summary,
      requests,
      newPings,
      acceptedRequests,
      isLogisticsPartner,
    };
  }, [payload]);
}

import { baseApi } from "@/store/redux/api/base-api";

function toCustomError(message: string) {
  return {
    error: {
      status: "CUSTOM_ERROR" as const,
      error: message,
    },
  };
}

export type PartnerDashboardRequirementItem = {
  id: string;
  title: string;
  uploadedFiles: Array<{
    id: string;
    fileName: string;
    uploadedAt: string;
    signedUrl: string | null;
  }>;
};

export type PartnerDashboardPayload = {
  partner: {
    id: string;
    offeredServiceStream: string | null;
  };
  requests: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    packageStream?: string;
    requirementItems: PartnerDashboardRequirementItem[];
  }>;
};

export type PartnerWorkOrdersPayload = {
  inboundProviderHandoffs: Array<{
    id: string;
    status: "pending" | "accepted" | "in_progress" | "completed" | "rejected";
    package_stream: string;
    assigned_at: string;
    metadata: {
      source_provider_name?: string | null;
      target_provider_name?: string | null;
    } | null;
    sales_order_items: {
      product_name: string;
      sales_orders: {
        po_reference: string | null;
        status: string;
      } | null;
    } | null;
  }>;
  outboundProviderHandoffs: Array<unknown>;
};

function isPartnerWorkOrdersPayload(
  value: unknown,
): value is PartnerWorkOrdersPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    inboundProviderHandoffs?: unknown;
    outboundProviderHandoffs?: unknown;
  };
  return (
    Array.isArray(candidate.inboundProviderHandoffs) &&
    Array.isArray(candidate.outboundProviderHandoffs)
  );
}

export const partnerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPartnerDashboard: builder.query<PartnerDashboardPayload, string>({
      queryFn: async () => {
        const response = await fetch("/api/partner/dashboard", {
          method: "GET",
          credentials: "include",
        });
        const body = (await response.json().catch(() => null)) as
          | PartnerDashboardPayload
          | { error?: string }
          | null;

        if (!response.ok || !body || !("requests" in body)) {
          return toCustomError(
            (body && "error" in body && typeof body.error === "string"
              ? body.error
              : null) ?? "Could not load partner dashboard.",
          );
        }

        return { data: body };
      },
      providesTags: (_result, _error, userId) => [
        { type: "PartnerDashboard", id: userId },
      ],
    }),
    getPartnerWorkOrders: builder.query<PartnerWorkOrdersPayload, string>({
      queryFn: async () => {
        const response = await fetch("/api/partner/work-orders", {
          method: "GET",
          credentials: "include",
        });
        const body = (await response.json().catch(() => null)) as
          | PartnerWorkOrdersPayload
          | { error?: string }
          | null;

        if (!response.ok || !isPartnerWorkOrdersPayload(body)) {
          return toCustomError(
            (body && "error" in body && typeof body.error === "string"
              ? body.error
              : null) ?? "Could not load partner work orders.",
          );
        }

        return {
          data: {
            inboundProviderHandoffs: body.inboundProviderHandoffs ?? [],
            outboundProviderHandoffs: body.outboundProviderHandoffs ?? [],
          },
        };
      },
      providesTags: (_result, _error, userId) => [
        { type: "PartnerWorkOrders", id: userId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const { useGetPartnerDashboardQuery, useGetPartnerWorkOrdersQuery } =
  partnerApi;

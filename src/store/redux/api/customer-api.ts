import { baseApi } from "@/store/redux/api/base-api";
import {
  listCustomerRequirements,
  type CustomerRequirementItem,
} from "@/services/requirements.service";
import {
  createCustomerRequest,
  getCustomerRequestById,
  listCustomerRequests,
  type RequestRecord,
} from "@/services/requests.service";
import {
  listRequestMessages,
  sendRequestMessage,
  type RequestMessageRecord,
} from "@/services/messages.service";

function toCustomError(message: string) {
  return {
    error: {
      status: "CUSTOM_ERROR" as const,
      error: message,
    },
  };
}

function readErrorMessage(body: unknown, fallback: string) {
  const value =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : null;
  return typeof value === "string" ? value : fallback;
}

export type CustomerOrderSummary = {
  id: string;
  status: string;
  poReference: string | null;
  updatedAt: string;
  timeline: Array<{ step?: string }>;
};

export type CustomerOrder = {
  id: string;
  status: string;
  totalCents: number;
  currencyCode: string;
  poReference: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  deliveredTo: string | null;
  slaDueAt: string | null;
  slaStatus: string | null;
  timeline: Array<{
    id?: string;
    step?: string;
    actor?: string;
    message?: string;
    at?: string;
  }>;
};

export type CustomerBillingSummary = {
  currentSubscription: {
    id?: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd: string | null;
    package: {
      id?: string;
      code?: "bronze" | "silver" | "premium";
      name: string;
      billingInterval?: string;
      currencyCode?: string;
      unitAmountCents?: number;
      metadata?: { display_price?: string };
    } | null;
  } | null;
  invoices: Array<{
    id?: string;
    invoiceNumber: string;
    status: string;
    currencyCode?: string;
    totalCents?: number;
    issuedAt: string | null;
    dueAt?: string | null;
    paidAt?: string | null;
    hostedInvoiceUrl?: string | null;
    pdfUrl?: string | null;
  }>;
};

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerRequirements: builder.query<CustomerRequirementItem[], string>({
      queryFn: async (organizationId) => {
        try {
          const data = await listCustomerRequirements(organizationId);
          return { data };
        } catch (error) {
          return toCustomError(
            error instanceof Error
              ? error.message
              : "Could not load customer requirements.",
          );
        }
      },
      providesTags: (_result, _error, organizationId) => [
        { type: "CustomerRequirements", id: organizationId },
      ],
    }),
    getCustomerOrders: builder.query<CustomerOrderSummary[], string>({
      queryFn: async () => {
        const response = await fetch("/api/customer/orders", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          return toCustomError(
            readErrorMessage(body, "Could not load customer orders."),
          );
        }

        return { data: (body?.orders ?? []) as CustomerOrderSummary[] };
      },
      providesTags: (_result, _error, organizationId) => [
        { type: "CustomerOrders", id: organizationId },
      ],
    }),
    getCustomerOrdersDetailed: builder.query<CustomerOrder[], string>({
      queryFn: async () => {
        const response = await fetch("/api/customer/orders", {
          method: "GET",
          credentials: "include",
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(
            readErrorMessage(body, "Could not load customer orders."),
          );
        }

        return { data: (body?.orders ?? []) as CustomerOrder[] };
      },
      providesTags: (_result, _error, organizationId) => [
        { type: "CustomerOrders", id: organizationId },
      ],
    }),
    getCustomerStepEvents: builder.query<string[], string>({
      queryFn: async (orderId) => {
        const response = await fetch(
          `/api/orders/${orderId}/step-events?audience=customer`,
          { credentials: "include" },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          return { data: [] };
        }

        return { data: (body?.completedStepKeys ?? []) as string[] };
      },
      providesTags: (_result, _error, orderId) => [
        { type: "StepEvents", id: orderId },
      ],
    }),
    getCustomerProviderReadiness: builder.query<
      {
        slas: { active: number; total: number };
        generatedCustomerRequests: number;
      },
      string
    >({
      queryFn: async () => {
        const response = await fetch("/api/customer/provider-readiness", {
          method: "GET",
          credentials: "include",
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          return toCustomError(
            readErrorMessage(body, "Could not load SLA metrics."),
          );
        }

        return {
          data: {
            slas: {
              active: Number(body?.slas?.active ?? 0),
              total: Number(body?.slas?.total ?? 0),
            },
            generatedCustomerRequests: Number(
              body?.generatedCustomerRequests ?? 0,
            ),
          },
        };
      },
      providesTags: (_result, _error, organizationId) => [
        { type: "ProviderReadiness", id: organizationId },
      ],
    }),
    getCustomerBillingSummary: builder.query<CustomerBillingSummary, string>({
      queryFn: async () => {
        const response = await fetch("/api/customer/billing", {
          credentials: "include",
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          return toCustomError(
            readErrorMessage(body, "Could not load billing summary."),
          );
        }

        return {
          data: {
            currentSubscription: body?.currentSubscription ?? null,
            invoices: body?.invoices ?? [],
          } as CustomerBillingSummary,
        };
      },
      providesTags: (_result, _error, organizationId) => [
        { type: "CustomerBilling", id: organizationId },
      ],
    }),
    getCustomerRequests: builder.query<RequestRecord[], string>({
      queryFn: async (customerId) => {
        try {
          const data = await listCustomerRequests(customerId);
          return { data };
        } catch (error) {
          return toCustomError(
            error instanceof Error
              ? error.message
              : "Could not load customer requests.",
          );
        }
      },
      providesTags: (_result, _error, customerId) => [
        { type: "CustomerRequests", id: customerId },
      ],
    }),
    getCustomerRequestById: builder.query<
      RequestRecord,
      { customerId: string; requestId: string }
    >({
      queryFn: async (input) => {
        try {
          const data = await getCustomerRequestById(input);
          return { data };
        } catch (error) {
          return toCustomError(
            error instanceof Error
              ? error.message
              : "Could not load customer request.",
          );
        }
      },
      providesTags: (_result, _error, input) => [
        { type: "CustomerRequests", id: input.customerId },
      ],
    }),
    getRequestMessages: builder.query<RequestMessageRecord[], string>({
      queryFn: async (requestId) => {
        try {
          const data = await listRequestMessages(requestId);
          return { data };
        } catch (error) {
          return toCustomError(
            error instanceof Error
              ? error.message
              : "Could not load request messages.",
          );
        }
      },
      providesTags: (_result, _error, requestId) => [
        { type: "RequestMessages", id: requestId },
      ],
    }),
    retractCustomerOrder: builder.mutation<
      { success?: boolean; error?: string },
      { orderId: string; organizationId: string }
    >({
      queryFn: async ({ orderId }) => {
        const response = await fetch(`/api/customer/orders/${orderId}`, {
          method: "DELETE",
          credentials: "include",
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          return toCustomError(
            readErrorMessage(body, "Could not retract order."),
          );
        }

        return { data: body ?? { success: true } };
      },
      invalidatesTags: (_result, _error, input) => [
        { type: "CustomerOrders", id: input.organizationId },
        { type: "CustomerRequirements", id: input.organizationId },
      ],
    }),
    updateCustomerBilling: builder.mutation<
      { success?: boolean; error?: string },
      {
        action: "cancel" | "upgrade";
        packageCode?: "bronze" | "silver" | "premium";
        organizationId: string;
      }
    >({
      queryFn: async ({ action, packageCode }) => {
        const response = await fetch("/api/customer/billing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, packageCode }),
        });

        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(
            readErrorMessage(body, "Billing update failed."),
          );
        }

        return { data: body ?? { success: true } };
      },
      invalidatesTags: (_result, _error, input) => [
        { type: "CustomerBilling", id: input.organizationId },
      ],
    }),
    createCustomerRequest: builder.mutation<
      RequestRecord,
      {
        customerId: string;
        title: string;
        description?: string;
        priority: "low" | "medium" | "high" | "urgent";
      }
    >({
      queryFn: async (input) => {
        try {
          const data = await createCustomerRequest(input);
          return { data };
        } catch (error) {
          return toCustomError(
            error instanceof Error
              ? error.message
              : "Could not create request.",
          );
        }
      },
      invalidatesTags: (_result, _error, input) => [
        { type: "CustomerRequests", id: input.customerId },
      ],
    }),
    sendCustomerRequestMessage: builder.mutation<
      RequestMessageRecord,
      { requestId: string; senderId: string; body: string }
    >({
      queryFn: async (input) => {
        try {
          const data = await sendRequestMessage(input);
          return { data };
        } catch (error) {
          return toCustomError(
            error instanceof Error ? error.message : "Could not send message.",
          );
        }
      },
      invalidatesTags: (_result, _error, input) => [
        { type: "RequestMessages", id: input.requestId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCustomerRequirementsQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerOrdersDetailedQuery,
  useGetCustomerStepEventsQuery,
  useGetCustomerProviderReadinessQuery,
  useGetCustomerBillingSummaryQuery,
  useGetCustomerRequestsQuery,
  useGetCustomerRequestByIdQuery,
  useGetRequestMessagesQuery,
  useRetractCustomerOrderMutation,
  useUpdateCustomerBillingMutation,
  useCreateCustomerRequestMutation,
  useSendCustomerRequestMessageMutation,
} = customerApi;

import { baseApi } from "@/store/redux/api/base-api";

function toCustomError(body: unknown, fallback: string) {
  const message =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : null;

  return {
    error: {
      status: "CUSTOM_ERROR" as const,
      error: typeof message === "string" ? message : fallback,
    },
  };
}

export const workflowApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWorkflowOrders: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/system/workflow/orders", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(body, "Could not load workflow orders.");
        }

        return { data: body ?? {} };
      },
      providesTags: (_result, _error, cacheKey) => [
        { type: "WorkflowOrders", id: cacheKey || "list" },
      ],
    }),
    getWorkflowOrderDetails: builder.query<unknown, string>({
      queryFn: async (orderId) => {
        const response = await fetch(
          `/api/system/workflow/orders?orderId=${encodeURIComponent(orderId)}`,
          {
            credentials: "include",
          },
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(body, "Could not load order details.");
        }

        return { data: body ?? {} };
      },
      providesTags: (_result, _error, orderId) => [
        { type: "WorkflowOrderDetails", id: orderId },
      ],
    }),
    getStepEvents: builder.query<
      string[],
      { orderId: string; audience: string }
    >({
      queryFn: async ({ orderId, audience }) => {
        const response = await fetch(
          `/api/orders/${orderId}/step-events?audience=${encodeURIComponent(audience)}`,
          { credentials: "include" },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) return { data: [] };
        return { data: (body?.completedStepKeys ?? []) as string[] };
      },
      providesTags: (_result, _error, { orderId, audience }) => [
        { type: "StepEvents", id: `${orderId}:${audience}` },
      ],
    }),
    dispatchWorkflow: builder.mutation<unknown, void>({
      queryFn: async () => {
        const response = await fetch("/api/system/workflow/dispatch", {
          method: "POST",
          credentials: "include",
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(body, "Could not run workflow dispatch.");
        }

        return { data: body ?? {} };
      },
      invalidatesTags: [{ type: "WorkflowOrders", id: "list" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWorkflowOrdersQuery,
  useGetWorkflowOrderDetailsQuery,
  useGetStepEventsQuery,
  useDispatchWorkflowMutation,
} = workflowApi;

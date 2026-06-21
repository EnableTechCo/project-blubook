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

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminUsersRoster: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/users-roster", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(body, "Could not load users.");
        }

        return { data: body ?? {} };
      },
      providesTags: (_result, _error, cacheKey) => [
        { type: "AdminUsers", id: cacheKey || "roster" },
      ],
    }),
    getAdminCustomers: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/customers", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(body, "Could not load customers.");
        }

        return { data: body ?? {} };
      },
      providesTags: (_result, _error, cacheKey) => [
        { type: "AdminCustomers", id: cacheKey || "customers" },
      ],
    }),
    getAdminWorkOrders: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/work-orders", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(body, "Could not load work orders.");
        }

        return { data: body ?? {} };
      },
      providesTags: (_result, _error, cacheKey) => [
        { type: "AdminWorkOrders", id: cacheKey || "work-orders" },
      ],
    }),
    getAdminDispatchQueue: builder.query<unknown, string>({
      queryFn: async (statusFilter) => {
        const query = new URLSearchParams();
        if (statusFilter && statusFilter !== "all") {
          query.set("status", statusFilter);
        }

        const response = await fetch(
          `/api/admin/dispatch-queue${query.size > 0 ? `?${query.toString()}` : ""}`,
          {
            credentials: "include",
          },
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          return toCustomError(body, "Could not load dispatch queue.");
        }

        return { data: body ?? {} };
      },
      providesTags: (_result, _error, statusFilter) => [
        { type: "AdminDispatchQueue", id: statusFilter || "all" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const adminApiExtended = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminServicePartners: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/service-partners", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok)
          return toCustomError(body, "Could not load service partners.");
        return { data: body ?? {} };
      },
      providesTags: () => [
        { type: "AdminServicePartners" as const, id: "list" },
      ],
    }),
    getAdminSalesPipeline: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/sales-pipeline", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok)
          return toCustomError(body, "Could not load sales pipeline.");
        return { data: body ?? {} };
      },
      providesTags: () => [
        { type: "AdminSalesPipeline" as const, id: "pipeline" },
      ],
    }),
    getAdminRoles: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/roles", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return toCustomError(body, "Could not load roles.");
        return { data: body ?? {} };
      },
      providesTags: () => [{ type: "AdminRoles" as const, id: "list" }],
    }),
    getAdminLogisticsHandoffs: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/logistics-handoffs", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok)
          return toCustomError(body, "Could not load logistics handoffs.");
        return { data: body ?? {} };
      },
      providesTags: () => [
        { type: "AdminLogisticsHandoffs" as const, id: "list" },
      ],
    }),
    getAdminAuditLogs: builder.query<unknown, string>({
      queryFn: async (queryString) => {
        const response = await fetch(
          `/api/admin/audit-logs${queryString ? `?${queryString}` : ""}`,
          { credentials: "include" },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok)
          return toCustomError(body, "Could not load audit logs.");
        return { data: body ?? {} };
      },
      providesTags: (_result, _error, queryString) => [
        { type: "AdminAuditLogs" as const, id: queryString || "all" },
      ],
    }),
    getAdminDashboardKpis: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/dashboard-kpis", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return toCustomError(body, "Could not load KPIs.");
        return { data: body ?? {} };
      },
      providesTags: () => [{ type: "AdminDashboardKpis" as const, id: "kpis" }],
    }),
  }),
  overrideExisting: false,
});

export const adminConfigApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminWorkflowConfig: builder.query<unknown, string>({
      queryFn: async () => {
        const response = await fetch("/api/admin/workflow-config", {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok)
          return toCustomError(body, "Could not load workflow settings.");
        return { data: body ?? {} };
      },
      providesTags: () => [
        { type: "AdminWorkflowConfig" as const, id: "config" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAdminWorkflowConfigQuery } = adminConfigApi;

export const {
  useGetAdminServicePartnersQuery,
  useGetAdminSalesPipelineQuery,
  useGetAdminRolesQuery,
  useGetAdminLogisticsHandoffsQuery,
  useGetAdminAuditLogsQuery,
  useGetAdminDashboardKpisQuery,
} = adminApiExtended;

export const {
  useGetAdminUsersRosterQuery,
  useGetAdminCustomersQuery,
  useGetAdminWorkOrdersQuery,
  useGetAdminDispatchQueueQuery,
} = adminApi;

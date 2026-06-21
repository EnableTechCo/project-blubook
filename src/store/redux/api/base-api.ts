import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const runtimeBaseUrl =
  typeof window === "undefined" ? "http://localhost" : window.location.origin;

export const baseApi = createApi({
  reducerPath: "baseApi",
  baseQuery: fetchBaseQuery({
    baseUrl: runtimeBaseUrl,
    credentials: "include",
  }),
  tagTypes: [
    "AuthUser",
    "CustomerContext",
    "Notifications",
    "CustomerBilling",
    "CustomerOrders",
    "CustomerRequirements",
    "CustomerRequests",
    "RequestMessages",
    "StepEvents",
    "ProviderReadiness",
    "PartnerDashboard",
    "PartnerWorkOrders",
    "AdminUsers",
    "AdminCustomers",
    "AdminWorkOrders",
    "AdminDispatchQueue",
    "AdminServicePartners",
    "AdminSalesPipeline",
    "AdminRoles",
    "AdminLogisticsHandoffs",
    "AdminAuditLogs",
    "AdminDashboardKpis",
    "AdminWorkflowConfig",
    "WorkflowOrders",
    "WorkflowOrderDetails",
  ],
  endpoints: () => ({}),
});

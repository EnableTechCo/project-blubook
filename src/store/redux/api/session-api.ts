import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { baseApi } from "@/store/redux/api/base-api";

function toCustomError(message: string) {
  return {
    error: {
      status: "CUSTOM_ERROR" as const,
      error: message,
    },
  };
}

export type CustomerContext = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  organizationId: string;
  organizationName: string | null;
};

export const sessionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuthUser: builder.query<User | null, void>({
      queryFn: async () => {
        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          return toCustomError(error.message);
        }

        return { data: user };
      },
      providesTags: ["AuthUser"],
    }),
    getCustomerContext: builder.query<CustomerContext, string>({
      queryFn: async (userId) => {
        const url =
          typeof window === "undefined"
            ? "http://localhost/api/auth/context"
            : "/api/auth/context";

        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: {
            "x-user-id": userId,
          },
        });

        const body = (await response.json().catch(() => null)) as {
          userId?: string | null;
          organizationId?: string | null;
          organizationName?: string | null;
          role?: string | null;
          error?: string;
          email?: string;
          fullName?: string | null;
        } | null;

        if (!response.ok || !body) {
          return toCustomError(
            body?.error ?? "Could not resolve customer context.",
          );
        }

        const organizationId = body.organizationId ?? null;
        if (!organizationId) {
          return toCustomError(
            "No organization mapping found for this user. Ensure user_profiles or organization_memberships includes this user.",
          );
        }

        return {
          data: {
            userId,
            email: body.email ?? "",
            fullName: body.fullName ?? null,
            role: body.role ?? "customer",
            organizationId,
            organizationName: body.organizationName ?? null,
          },
        };
      },
      providesTags: (_result, _error, userId) => [
        { type: "CustomerContext", id: userId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAuthUserQuery, useGetCustomerContextQuery } = sessionApi;

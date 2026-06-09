"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

type CustomerContext = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  organizationId: string;
  organizationName: string | null;
};

export function useCustomerContext() {
  const authQuery = useAuth();

  return useQuery({
    queryKey: ["customer-context", authQuery.data?.id],
    enabled: Boolean(authQuery.data?.id),
    queryFn: async (): Promise<CustomerContext> => {
      const user = authQuery.data;

      if (!user) {
        throw new Error("Unauthorized");
      }

      const response = await fetch("/api/auth/context", {
        method: "GET",
        credentials: "include",
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        userId?: string | null;
        organizationId?: string | null;
        organizationName?: string | null;
        role?: string | null;
      } | null;

      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Could not resolve customer context.");
      }

      const organizationId = body.organizationId ?? null;
      const role = body.role ?? null;
      const email = user.email ?? "";
      const fullName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : null;

      if (!organizationId) {
        throw new Error(
          "No organization mapping found for this user. Ensure user_profiles or organization_memberships includes this user.",
        );
      }

      return {
        userId: user.id,
        email,
        fullName,
        role: role ?? "customer",
        organizationId,
        organizationName: body.organizationName ?? null,
      };
    },
  });
}

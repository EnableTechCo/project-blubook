"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
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
      const supabase = createClient();
      const user = authQuery.data;

      if (!user) {
        throw new Error("Unauthorized");
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("user_id, email, full_name, role, organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let organizationId = profile?.organization_id ?? null;
      let role = profile?.role ?? null;
      let email = profile?.email ?? user.email ?? "";
      let fullName =
        profile?.full_name ??
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : null);

      // Fallback for users that exist in Auth but do not yet have a profile row.
      if (!organizationId && !profileError) {
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("organization_id, role, email")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!membershipError && membership?.organization_id) {
          organizationId = membership.organization_id;
          role = role ?? membership.role;
          email = email || membership.email || "";
        }
      }

      let organizationName: string | null = null;
      if (organizationId) {
        const { data: organization } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", organizationId)
          .maybeSingle();

        organizationName = organization?.name ?? null;
      }

      return {
        userId: user.id,
        email,
        fullName,
        role: role ?? "customer",
        organizationId: organizationId ?? user.id,
        organizationName,
      };
    },
  });
}

"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetCustomerContextQuery } from "@/store/redux/api/session-api";

export function useCustomerContext() {
  const authQuery = useAuth();
  const user = authQuery.data ?? null;

  const contextQuery = useGetCustomerContextQuery(user?.id ?? "", {
    skip: !user?.id,
  });

  return useMemo(() => {
    const fullName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user?.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null;

    const email = user?.email ?? "";

    return {
      ...contextQuery,
      data: contextQuery.data
        ? {
            ...contextQuery.data,
            email,
            fullName,
          }
        : undefined,
    };
  }, [contextQuery, user?.email, user?.user_metadata]);
}

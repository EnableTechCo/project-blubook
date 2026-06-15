import { useMemo } from "react";

export function usePartnerDashboardActions<T extends Record<string, unknown>>(
  actions: T,
): T {
  return useMemo(() => actions, [actions]);
}

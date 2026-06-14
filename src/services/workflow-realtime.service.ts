import { createClient } from "@/lib/supabase/browser";

function createChannelName(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeToCustomerOrderProgress(
  organizationId: string,
  callback: () => void,
) {
  const supabase = createClient();
  const channel = supabase
    .channel(createChannelName(`customer-orders-${organizationId}`))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sales_orders",
        filter: `organization_id=eq.${organizationId}`,
      },
      callback,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "provider_workflow_handoffs",
        filter: `organization_id=eq.${organizationId}`,
      },
      callback,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToPartnerWorkOrders(callback: () => void) {
  const supabase = createClient();
  const channel = supabase
    .channel(createChannelName("partner-work-orders"))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "provider_workflow_handoffs",
      },
      callback,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sales_orders",
      },
      callback,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToPartnerDashboardRequests(
  providerId: string,
  callback: () => void,
) {
  const supabase = createClient();
  const channel = supabase
    .channel(createChannelName(`partner-dashboard-${providerId}`))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "customer_provider_requests",
        filter: `provider_id=eq.${providerId}`,
      },
      callback,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

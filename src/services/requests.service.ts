import { createClient } from "@/lib/supabase/browser";

export interface RequestRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  customer_id: string;
  partner_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCustomerRequests(customerId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as RequestRecord[];
}

export async function getCustomerRequestById(input: {
  customerId: string;
  requestId: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("customer_id", input.customerId)
    .eq("id", input.requestId)
    .single();

  if (error) {
    throw error;
  }

  return data as RequestRecord;
}

export async function createCustomerRequest(input: {
  customerId: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      customer_id: input.customerId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      status: "submitted",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RequestRecord;
}

export async function cancelCustomerRequest(input: {
  requestId: string;
  customerId: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .update({ status: "cancelled" })
    .eq("id", input.requestId)
    .eq("customer_id", input.customerId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RequestRecord;
}

export async function listPartnerInbox(partnerId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("partner_id", partnerId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as RequestRecord[];
}

export async function updatePartnerRequestStatus(input: {
  requestId: string;
  partnerId: string;
  status: "in_progress" | "completed" | "rejected";
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .update({ status: input.status })
    .eq("id", input.requestId)
    .eq("partner_id", input.partnerId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RequestRecord;
}

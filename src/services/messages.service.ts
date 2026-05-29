import { createClient } from "@/lib/supabase/browser";

export interface RequestMessageRecord {
  id: string;
  request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export async function listRequestMessages(requestId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("request_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RequestMessageRecord[];
}

export async function sendRequestMessage(input: {
  requestId: string;
  senderId: string;
  body: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("request_messages")
    .insert({
      request_id: input.requestId,
      sender_id: input.senderId,
      body: input.body,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RequestMessageRecord;
}

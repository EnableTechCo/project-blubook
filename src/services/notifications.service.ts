import { createClient } from "@/lib/supabase/browser";

export interface NotificationRecord {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  customer_name?: string | null;
  customerName?: string | null;
  organization_name?: string | null;
  organizationName?: string | null;
  payload?: {
    customer_name?: string;
    customerName?: string;
    organization_name?: string;
    organizationName?: string;
  } | null;
}

export async function listNotifications(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  return (data ?? []) as NotificationRecord[];
}

export async function markNotificationRead(input: {
  notificationId: string;
  userId: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", input.notificationId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as NotificationRecord;
}

export async function markAllNotificationsRead(userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw error;
  }
}

export async function subscribeToNotifications(
  userId: string,
  callback: () => void,
) {
  const supabase = createClient();

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      callback,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

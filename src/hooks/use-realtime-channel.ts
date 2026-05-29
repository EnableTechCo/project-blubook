"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

export function useRealtimeChannel(channelName: string) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(channelName).subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName]);
}

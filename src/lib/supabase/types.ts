import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type AppSupabaseClient = SupabaseClient<Database>;

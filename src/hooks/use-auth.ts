"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { baseApi } from "@/store/redux/api/base-api";
import { useAppDispatch } from "@/store/redux/hooks";
import { useGetAuthUserQuery } from "@/store/redux/api/session-api";

export function useAuth() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const query = useGetAuthUserQuery();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void query.refetch();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [query]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    dispatch(baseApi.util.resetApiState());
    router.push("/login");
  };

  return {
    ...query,
    user: query.data,
    signOut,
  };
}

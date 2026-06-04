"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query"; 
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const query = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      return user;
    },
  });

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

 //Sign Out logic
  const signOut = async () => {
    const supabase = createClient();
    
    //invalidate the user session tokens
    await supabase.auth.signOut();
    
    //clear the cached user data 
    queryClient.setQueryData(["auth-user"], null);
    
    //redirect the browser to the login screen
    router.push("/login");
  };

  return {
    ...query,        
    user: query.data, 
    signOut,          // Exposes the sign-out action to our UI components
  };
}
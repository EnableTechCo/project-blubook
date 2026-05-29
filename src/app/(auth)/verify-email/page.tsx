"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState("Verifying your session...");

  useEffect(() => {
    let active = true;
    const run = async () => {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (error) {
        setStatus(`Verification failed: ${error.message}`);
        return;
      }

      if (user?.email_confirmed_at) {
        setStatus("Email verified successfully. Continue to login.");
      } else {
        setStatus(
          "Email not yet verified. Open the verification link sent to your inbox.",
        );
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h2 className="text-3xl font-semibold">Verify Email</h2>
      <p className="mt-4 text-sm text-slate-200/90">{status}</p>
      <div className="mt-6">
        <Link href="/login">
          <Button>Go to Login</Button>
        </Link>
      </div>
    </div>
  );
}

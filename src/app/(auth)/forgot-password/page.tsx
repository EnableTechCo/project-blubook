"use client";

import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    setStatus(
      error
        ? `Reset request failed: ${error.message}`
        : "Password reset email sent. Check your inbox.",
    );
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold">Forgot Password</h2>
      <p className="mt-1 text-sm text-slate-200/80">
        Send a secure reset link to your account email.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      {status ? (
        <p className="mt-4 text-sm text-slate-200/90">{status}</p>
      ) : null}
    </div>
  );
}

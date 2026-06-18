"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setStatus(`Password reset failed: ${error.message}`);
      return;
    }

    setStatus("Password updated. Redirecting to login...");
    setTimeout(() => {
      router.push("/login");
    }, 1000);
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold">Reset Password</h2>
      <p className="mt-1 text-sm text-slate-200/80">
        Set a new password for your account.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
      {status ? (
        <p className="mt-4 text-sm text-slate-200/90">{status}</p>
      ) : null}
    </div>
  );
}

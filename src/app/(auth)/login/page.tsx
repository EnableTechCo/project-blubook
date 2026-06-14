"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { ROLE_HOME } from "@/constants/routes";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const isSessionExpired = searchParams.get("reason") === "session_expired";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const hasSensitiveParams =
      url.searchParams.has("email") || url.searchParams.has("password");

    if (!hasSensitiveParams) {
      return;
    }

    url.searchParams.delete("email");
    url.searchParams.delete("password");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");

    // During hydration races, controlled state can momentarily lag behind input DOM values.
    const effectiveEmail = email || submittedEmail;
    const effectivePassword = password || submittedPassword;

    if (!effectiveEmail || !effectivePassword) {
      setStatus("Email and password are required.");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: effectiveEmail,
        password: effectivePassword,
      });

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      const role = data.user?.user_metadata?.role;
      const next = searchParams.get("next")?.trim() ?? "";

      if (next.startsWith("/")) {
        window.location.replace(next);
        return;
      }

      if (role === "partner" || role === "logistics" || role === "sales") {
        router.replace(ROLE_HOME.partner);
        router.refresh();
        return;
      }

      if (role === "staff") {
        router.replace(ROLE_HOME.staff);
        router.refresh();
        return;
      }

      if (role === "admin") {
        router.replace(ROLE_HOME.admin);
        router.refresh();
        return;
      }

      router.replace(ROLE_HOME.customer);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed.");
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-3xl font-semibold">Login</h2>
      <p className="mt-1 text-sm text-slate-200/80">
        Use your assigned credentials to continue.
      </p>
      {isSessionExpired ? (
        <p className="mt-3 rounded-lg border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          Your session expired. Please log in again.
        </p>
      ) : null}

      <form onSubmit={onSubmit} method="post" className="mt-6 space-y-4">
        <label className="block space-y-1 text-sm text-slate-200">
          <span>Email address</span>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm text-slate-200">
          <span>Password</span>
          <Input
            id="login-password"
            name="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </Button>
        {status ? <p className="text-sm text-red-300">{status}</p> : null}
      </form>

      <div className="mt-4 flex justify-between text-sm text-slate-200/80">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/onboarding">Start customer onboarding</Link>
      </div>
    </>
  );
}

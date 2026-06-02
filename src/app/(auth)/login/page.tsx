"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { ROLE_HOME } from "@/constants/routes";
import { MOCK_PORTAL_LINKS } from "@/features/mock/dashboard-data";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      router.push(ROLE_HOME.customer);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold">Login</h2>
      <p className="mt-1 text-sm text-slate-200/80">
        Use credentials to sign in, or open a portal directly below.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </Button>
      </form>

      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {MOCK_PORTAL_LINKS.map((portal) => (
          <Link key={portal.href} href={portal.href}>
            <Button className="w-full" variant="ghost">
              Open {portal.label} Dashboard
            </Button>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex justify-between text-sm text-slate-200/80">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/register">Register</Link>
      </div>
    </div>
  );
}

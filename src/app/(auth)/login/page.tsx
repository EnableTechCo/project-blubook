"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { ROLE_HOME } from "@/constants/routes";
import { MOCK_LOGIN_CREDENTIALS } from "@/features/mock/dashboard-data";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      router.push(ROLE_HOME.customer);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const mockUser = MOCK_LOGIN_CREDENTIALS.find(
      (item) =>
        item.email.toLowerCase() === normalizedEmail &&
        item.password === password,
    );

    if (mockUser) {
      router.push(mockUser.home);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    const role = data.user?.user_metadata?.role;
    if (role === "partner") {
      router.push(ROLE_HOME.partner);
      return;
    }

    router.push(ROLE_HOME.customer);
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold">Login</h2>
      <p className="mt-1 text-sm text-slate-200/80">
        Use customer or partner credentials to sign in.
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
        {status ? <p className="text-sm text-red-300">{status}</p> : null}
      </form>

      <div className="mt-4 flex justify-between text-sm text-slate-200/80">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/register">Register</Link>
      </div>
    </div>
  );
}

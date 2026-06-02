"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { ROLE_HOME } from "@/constants/routes";
import { MOCK_ROLE_ORDER, MOCK_USERS } from "@/features/mock/dashboard-data";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const quickUsers = MOCK_ROLE_ORDER.map((role) =>
    MOCK_USERS.find((user) => user.role === role && user.status === "active"),
  ).filter((user): user is NonNullable<typeof user> => Boolean(user));

  const mockTestUsers = MOCK_USERS.filter((user) => user.status === "active");

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
        Dev mode: fields are optional. Use quick access with mock users to open
        each dashboard role.
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
        {quickUsers.map((user) => (
          <Link key={user.id} href={ROLE_HOME[user.role]}>
            <Button className="w-full" variant="ghost">
              {user.fullName} ({user.role})
            </Button>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Mock Test Users</p>
        <p className="mt-1 text-xs text-slate-200/80">
          Use these active mock profiles to validate role dashboards in dev
          mode.
        </p>
        <div className="mt-3 max-h-44 space-y-2 overflow-y-auto text-sm text-slate-100">
          {mockTestUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-white/10 bg-black/15 px-3 py-2"
            >
              <p className="font-medium">{user.fullName}</p>
              <p className="text-xs text-slate-200/80">{user.email}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-cyan-200/80">
                {user.role} · {user.department}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-between text-sm text-slate-200/80">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/register">Register</Link>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { parseInviteMember } from "@/features/auth/invite-debug";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const member = parseInviteMember(searchParams.get("member"));
  const invitedName =
    searchParams.get("name") ?? searchParams.get("fullName") ?? member.name;
  const invitedEmail = searchParams.get("email") ?? member.email;

  const displayName = name || invitedName;
  const displayEmail = email || invitedEmail;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = createClient();
    await supabase.auth.signUp({
      email: displayEmail,
      password,
      options: {
        data: {
          full_name: displayName,
          name: displayName,
          role: "customer",
        },
      },
    });
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold">Register</h2>
      <p className="mt-1 text-sm text-slate-200/80">
        Invite-only mode can be enforced by RLS and auth hooks.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          placeholder="Full name"
          value={name || invitedName}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type="email"
          placeholder="you@company.com"
          value={email || invitedEmail}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button className="w-full">Create account</Button>
      </form>
    </div>
  );
}

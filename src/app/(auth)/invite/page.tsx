"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { parseInviteMember } from "@/features/auth/invite-debug";

export default function InvitePage() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token =
    searchParams.get("token") ?? searchParams.get("inviteToken") ?? "";
  const type = (searchParams.get("type") ?? "invite") as
    | "signup"
    | "invite"
    | "magiclink"
    | "recovery"
    | "email_change";
  const member = parseInviteMember(searchParams.get("member"));
  const email = searchParams.get("email") ?? member.email;
  const name =
    searchParams.get("name") ?? searchParams.get("fullName") ?? member.name;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !email) {
      setStatus("Missing invite token or email in link.");
      return;
    }

    setLoading(true);
    setStatus(null);
    const supabase = createClient();
    const verify = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (verify.error) {
      setLoading(false);
      setStatus(`Invite verification failed: ${verify.error.message}`);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    setStatus(
      error
        ? `Could not complete setup: ${error.message}`
        : "Invite accepted. You can now continue into the platform.",
    );
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold">Accept Invite</h2>
      <p className="mt-1 text-sm text-slate-200/80">
        Complete onboarding by setting your account password.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input type="text" value={name} readOnly placeholder="Full name" />
        <Input type="email" value={email} readOnly placeholder="Email" />
        <Input
          type="password"
          placeholder="Create password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button className="w-full" disabled={loading || !token || !email}>
          {loading ? "Activating..." : "Activate account"}
        </Button>
      </form>
      {status ? (
        <p className="mt-4 text-sm text-slate-200/90">{status}</p>
      ) : null}

      <div className="mt-4 text-sm text-slate-200/80">
        Missing invite details? Open the register page with query params:{" "}
        <Link
          className="text-cyan-200 underline"
          href={`/register?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`}
        >
          Go to register
        </Link>
      </div>
    </div>
  );
}

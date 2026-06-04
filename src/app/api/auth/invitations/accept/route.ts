import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const payload = acceptInviteSchema.parse(await request.json());
    const admin = createAdminClient();
    const tokenHash = hashToken(payload.token);

    const { data: invitation, error: invitationError } = await admin
      .from("invitations")
      .select(
        "id, email, role, status, expires_at, organization_id, membership_id",
      )
      .eq("token_hash", tokenHash)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "Invalid invitation." },
        { status: 400 },
      );
    }

    if (invitation.email.toLowerCase() !== payload.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Invite email does not match." },
        { status: 400 },
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Invitation is no longer valid." },
        { status: 400 },
      );
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await admin
        .from("invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return NextResponse.json(
        { error: "Invitation has expired." },
        { status: 400 },
      );
    }

    const { data: createdUser, error: userError } =
      await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          full_name: payload.fullName,
          name: payload.fullName,
          role: invitation.role,
        },
      });

    if (userError || !createdUser.user?.id) {
      return NextResponse.json(
        { error: userError?.message ?? "Could not activate invite." },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();

    const { error: profileError } = await admin.from("user_profiles").upsert(
      {
        user_id: createdUser.user.id,
        organization_id: invitation.organization_id,
        full_name: payload.fullName,
        email: payload.email,
        role: invitation.role,
        membership_status: "active",
        invited_at: nowIso,
        activated_at: nowIso,
      },
      { onConflict: "user_id" },
    );

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 },
      );
    }

    if (invitation.membership_id) {
      await admin
        .from("organization_memberships")
        .update({
          user_id: createdUser.user.id,
          status: "active",
          accepted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", invitation.membership_id);
    }

    await admin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", invitation.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not accept invite.",
      },
      { status: 500 },
    );
  }
}

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { queueEmail, dispatchQueuedEmails } from "@/lib/email/dispatcher";

const sendInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["partner", "admin"]),
  fullName: z.string().min(2),
  organizationName: z.string().min(2).optional(),
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = sendInviteSchema.parse(await request.json());
    const admin = createAdminClient();

    const { data: inviterProfile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!inviterProfile || !["admin", "staff"].includes(inviterProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationKind = payload.role === "partner" ? "partner" : "admin";
    const organizationName =
      payload.organizationName ??
      (payload.role === "partner"
        ? `${payload.fullName} Partner Org`
        : "BluBook Admin Team");

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({
        kind: organizationKind,
        name: organizationName,
        primary_contact_name: payload.fullName,
        primary_contact_email: payload.email,
      })
      .select("id")
      .single();

    if (organizationError || !organization) {
      return NextResponse.json(
        {
          error: organizationError?.message ?? "Could not create organization.",
        },
        { status: 400 },
      );
    }

    const { data: membership, error: membershipError } = await admin
      .from("organization_memberships")
      .insert({
        organization_id: organization.id,
        email: payload.email,
        role: payload.role,
        status: "invited",
        is_primary: true,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: membershipError?.message ?? "Could not create membership." },
        { status: 400 },
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + (payload.expiresInHours ?? 72) * 60 * 60 * 1000,
    ).toISOString();

    const { data: invitation, error: invitationError } = await admin
      .from("invitations")
      .insert({
        organization_id: organization.id,
        membership_id: membership.id,
        email: payload.email,
        role: payload.role,
        token_hash: tokenHash,
        status: "pending",
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: invitationError?.message ?? "Could not create invitation." },
        { status: 400 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const inviteLink = `${baseUrl}/invite?token=${token}&email=${encodeURIComponent(payload.email)}&name=${encodeURIComponent(payload.fullName)}`;

    await queueEmail({
      templateKey:
        payload.role === "partner" ? "partner-invite" : "admin-invite",
      toEmail: payload.email,
      organizationId: organization.id,
      invitationId: invitation.id,
      subjectFallback:
        payload.role === "partner"
          ? "Your BluBook partner invite"
          : "Your BluBook admin invite",
      payload: {
        invite_link: inviteLink,
        invited_name: payload.fullName,
        role: payload.role,
      },
    });

    await dispatchQueuedEmails(5);

    return NextResponse.json({
      ok: true,
      invitationId: invitation.id,
      inviteLink,
      expiresAt,
    });
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
          error instanceof Error ? error.message : "Could not send invite.",
      },
      { status: 500 },
    );
  }
}

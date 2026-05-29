export interface InviteMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  invitationStatus: string;
}

export function normalizeInviteMember(
  member: Partial<InviteMember> | null | undefined,
) {
  if (!member) {
    return { name: "", email: "" };
  }

  return {
    name: member.name ?? "",
    email: member.email ?? "",
  };
}

export function parseInviteMember(input: string | null | undefined) {
  if (!input) {
    return { name: "", email: "" };
  }

  try {
    const parsed = JSON.parse(input) as Partial<InviteMember>;
    return normalizeInviteMember(parsed);
  } catch {
    return { name: "", email: "" };
  }
}

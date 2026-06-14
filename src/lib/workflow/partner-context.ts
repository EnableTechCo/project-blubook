import { createAdminClient } from "@/lib/supabase/admin";

export function readServicePartnerId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as { service_partner_id?: unknown })
    .service_partner_id;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

export async function resolveServicePartnerIdForPartnerUser(input: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  profileMetadata: unknown;
  profileOrganizationId?: string | null;
  userMetadata: unknown;
}) {
  const directId = firstNonEmpty([
    readServicePartnerId(input.profileMetadata),
    readServicePartnerId(input.userMetadata),
  ]);

  if (directId) {
    return directId;
  }

  const { data: memberships } = await input.admin
    .from("organization_memberships")
    .select("organization_id, metadata")
    .eq("user_id", input.userId)
    .eq("status", "active");

  const membershipId = firstNonEmpty(
    (memberships ?? []).map((row) => readServicePartnerId(row.metadata)),
  );
  if (membershipId) {
    return membershipId;
  }

  const organizationIds = Array.from(
    new Set(
      [
        input.profileOrganizationId ?? null,
        ...(memberships ?? []).map((row) => row.organization_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  if (organizationIds.length === 0) {
    return null;
  }

  const { data: organizations } = await input.admin
    .from("organizations")
    .select("id, metadata")
    .in("id", organizationIds);

  return firstNonEmpty(
    (organizations ?? []).map((row) => readServicePartnerId(row.metadata)),
  );
}

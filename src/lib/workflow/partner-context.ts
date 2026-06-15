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

  const membershipRows = memberships ?? [];

  // Prefer the current profile organization when multiple active memberships exist.
  if (input.profileOrganizationId) {
    const preferredMembershipId = firstNonEmpty(
      membershipRows
        .filter((row) => row.organization_id === input.profileOrganizationId)
        .map((row) => readServicePartnerId(row.metadata)),
    );

    if (preferredMembershipId) {
      return preferredMembershipId;
    }
  }

  const uniqueMembershipIds = Array.from(
    new Set(
      membershipRows
        .map((row) => readServicePartnerId(row.metadata))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (uniqueMembershipIds.length === 1) {
    return uniqueMembershipIds[0];
  }

  if (uniqueMembershipIds.length > 1) {
    // Deterministic fallback to avoid random partner switching between requests.
    return uniqueMembershipIds.slice().sort((a, b) => a.localeCompare(b))[0];
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

  const organizationRows = organizations ?? [];
  if (input.profileOrganizationId) {
    const preferredOrganizationId = firstNonEmpty(
      organizationRows
        .filter((row) => row.id === input.profileOrganizationId)
        .map((row) => readServicePartnerId(row.metadata)),
    );

    if (preferredOrganizationId) {
      return preferredOrganizationId;
    }
  }

  return firstNonEmpty(
    organizationRows
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((row) => readServicePartnerId(row.metadata)),
  );
}

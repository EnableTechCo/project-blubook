type ServicePartnerRow = {
  id: string;
  package_stream: string;
  name: string;
  metadata: unknown;
};

type ServicePartnerMetadata = {
  email?: unknown;
  contact_email?: unknown;
  notification_email?: unknown;
  partner_email?: unknown;
  default_for_stream?: unknown;
  is_default?: unknown;
  routing_default?: unknown;
};

type ResolveServicePartnerInput = {
  admin: any;
  stream: string;
  preferredEmail?: string | null;
  preferredNameHint?: string | null;
};

export type ResolvedServicePartner = {
  id: string;
  packageStream: string;
  name: string;
  selectionReason:
    | "preferred_email"
    | "metadata_default"
    | "name_hint"
    | "alphabetical_fallback";
};

function asMetadata(value: unknown): ServicePartnerMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as ServicePartnerMetadata;
}

function readPartnerEmail(value: unknown) {
  const metadata = asMetadata(value);
  const candidates = [
    metadata.email,
    metadata.contact_email,
    metadata.notification_email,
    metadata.partner_email,
  ];
  const found = candidates.find(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
  return found ?? null;
}

function readMetadataDefaultFlag(value: unknown) {
  const metadata = asMetadata(value);
  return (
    metadata.default_for_stream === true ||
    metadata.is_default === true ||
    metadata.routing_default === true
  );
}

export async function resolveServicePartnerForStream(
  input: ResolveServicePartnerInput,
): Promise<ResolvedServicePartner | null> {
  const { data, error } = await input.admin
    .from("service_partners")
    .select("id, package_stream, name, metadata")
    .eq("package_stream", input.stream)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const candidates: ServicePartnerRow[] = [
    ...((data ?? []) as ServicePartnerRow[]),
  ].sort((a: ServicePartnerRow, b: ServicePartnerRow) =>
    a.name.localeCompare(b.name),
  );

  if (candidates.length === 0) {
    return null;
  }

  const preferredEmail = input.preferredEmail?.trim().toLowerCase() ?? null;
  if (preferredEmail) {
    const byEmail = candidates.find(
      (item: ServicePartnerRow) =>
        readPartnerEmail(item.metadata)?.toLowerCase() === preferredEmail,
    );
    if (byEmail) {
      return {
        id: byEmail.id,
        packageStream: byEmail.package_stream,
        name: byEmail.name,
        selectionReason: "preferred_email",
      };
    }
  }

  const byMetadataDefault = candidates.find((item: ServicePartnerRow) =>
    readMetadataDefaultFlag(item.metadata),
  );
  if (byMetadataDefault) {
    return {
      id: byMetadataDefault.id,
      packageStream: byMetadataDefault.package_stream,
      name: byMetadataDefault.name,
      selectionReason: "metadata_default",
    };
  }

  const preferredNameHint =
    input.preferredNameHint?.trim().toLowerCase() ?? null;
  if (preferredNameHint) {
    const byNameHint = candidates.find((item: ServicePartnerRow) =>
      item.name.toLowerCase().includes(preferredNameHint),
    );
    if (byNameHint) {
      return {
        id: byNameHint.id,
        packageStream: byNameHint.package_stream,
        name: byNameHint.name,
        selectionReason: "name_hint",
      };
    }
  }

  const fallback = candidates[0];
  return {
    id: fallback.id,
    packageStream: fallback.package_stream,
    name: fallback.name,
    selectionReason: "alphabetical_fallback",
  };
}

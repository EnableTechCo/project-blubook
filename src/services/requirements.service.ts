import { createClient } from "@/lib/supabase/browser";

function extractOrganizationIdFromPath(path: string) {
  const parts = path.split("/");
  if (parts.length >= 2 && parts[0] === "organizations") {
    return parts[1] || null;
  }

  return null;
}

async function resolveValidOrganizationId(
  supabase: ReturnType<typeof createClient>,
  path: string,
) {
  const candidate = extractOrganizationIdFromPath(path);
  if (!candidate) {
    return null;
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", candidate)
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  return data.id;
}

export type RequirementStatus =
  | "missing"
  | "submitted"
  | "approved"
  | "rejected";

export interface CustomerRequirementItem {
  id: string;
  packageStream: string;
  providerName: string | null;
  title: string;
  description: string | null;
  whyRequired: string | null;
  evidenceType: string;
  isRequired: boolean;
  status: RequirementStatus;
  statusReason: string | null;
  dueAt: string | null;
  updatedAt: string;
}

export async function listCustomerRequirements(organizationId: string) {
  const supabase = createClient();

  const { data: requirementRows, error: requirementsError } = await supabase
    .from("customer_requirement_items")
    .select(
      "id, package_stream, provider_id, title, description, why_required, evidence_type, is_required, status, status_reason, due_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("package_stream", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (requirementsError) {
    throw requirementsError;
  }

  const providerIds = Array.from(
    new Set(
      (requirementRows ?? [])
        .map((row) => row.provider_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const providerNamesById = new Map<string, string>();

  if (providerIds.length > 0) {
    const { data: providerRows, error: providersError } = await supabase
      .from("service_partners")
      .select("id, name")
      .in("id", providerIds);

    if (providersError) {
      throw providersError;
    }

    for (const provider of providerRows ?? []) {
      providerNamesById.set(provider.id, provider.name);
    }
  }

  return (requirementRows ?? []).map((row) => ({
    id: row.id,
    packageStream: row.package_stream,
    providerName: row.provider_id
      ? (providerNamesById.get(row.provider_id) ?? null)
      : null,
    title: row.title,
    description: row.description,
    whyRequired: row.why_required,
    evidenceType: row.evidence_type,
    isRequired: row.is_required,
    status: row.status as RequirementStatus,
    statusReason: row.status_reason,
    dueAt: row.due_at,
    updatedAt: row.updated_at,
  })) as CustomerRequirementItem[];
}

export async function submitRequirementEvidence(input: {
  requirementItemId: string;
  bucket: string;
  prefix: string;
  file: File;
  customerNote?: string;
}) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "You must be signed in to upload.");
  }

  const cleanedName = input.file.name.replace(/\s+/g, "-").toLowerCase();
  const path = `${input.prefix}/${Date.now()}-${cleanedName}`;

  const { error: uploadError } = await supabase.storage
    .from(input.bucket)
    .upload(path, input.file, { upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const fileName = path.split("/").pop() ?? input.file.name;
  const organizationId = await resolveValidOrganizationId(supabase, path);

  const { data: documentRow, error: documentError } = await supabase
    .from("documents")
    .insert({
      uploaded_by: user.id,
      organization_id: organizationId,
      bucket: input.bucket,
      path,
      file_name: fileName,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
    })
    .select("id")
    .single();

  if (documentError || !documentRow) {
    await supabase.storage.from(input.bucket).remove([path]);
    throw documentError ?? new Error("Could not create document record.");
  }

  const { error: evidenceError } = await supabase.rpc(
    "submit_customer_requirement_evidence",
    {
      p_requirement_item_id: input.requirementItemId,
      p_document_id: documentRow.id,
      p_storage_bucket: input.bucket,
      p_storage_path: path,
      p_file_name: fileName,
      p_mime_type: input.file.type || null,
      p_size_bytes: input.file.size,
      p_customer_note: input.customerNote ?? null,
    },
  );

  if (evidenceError) {
    await supabase.from("documents").delete().eq("id", documentRow.id);
    await supabase.storage.from(input.bucket).remove([path]);
    throw evidenceError;
  }

  return { documentId: documentRow.id, path };
}

const requirementsService = {
  listCustomerRequirements,
  submitRequirementEvidence,
};

export default requirementsService;

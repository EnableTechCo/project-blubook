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
  const response = await fetch(
    `/api/customer/requirements?organizationId=${encodeURIComponent(organizationId)}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not load customer requirements.");
  }

  return (payload ?? []) as CustomerRequirementItem[];
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

  const kickoffRequest = fetch("/api/customer/workflow/po-uploaded", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requirementItemId: input.requirementItemId,
      fileName: input.file.name,
    }),
  }).catch(() => null);

  // Keep the dashboard responsive when kickoff is slow; backend work can continue.
  const kickoffResponse = await Promise.race([
    kickoffRequest,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 12000);
    }),
  ]);

  let kickoff: {
    ok?: boolean;
    skipped?: boolean;
    reason?: string;
    salesOrderId?: string | null;
    poReference?: string | null;
    queuedEventId?: string | null;
    error?: string;
  } | null = null;

  if (kickoffResponse?.ok) {
    kickoff = await kickoffResponse.json().catch(() => null);
  }

  if (kickoffResponse && !kickoffResponse.ok) {
    const kickoffPayload = await kickoffResponse.json().catch(() => null);
    console.warn("[requirements] PO workflow kickoff did not complete", {
      requirementItemId: input.requirementItemId,
      error: kickoffPayload?.error ?? "unknown",
    });
  }

  if (!kickoffResponse) {
    console.warn("[requirements] PO workflow kickoff still processing", {
      requirementItemId: input.requirementItemId,
    });
  }

  return { documentId: documentRow.id, path, kickoff };
}

const requirementsService = {
  listCustomerRequirements,
  submitRequirementEvidence,
};

export default requirementsService;

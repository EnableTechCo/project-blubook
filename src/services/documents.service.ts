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

export interface DocumentRecord {
  name: string;
  path: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  documentType?: string;
  documentTypeLabel?: string;
  groupKey?:
    | "requirements-docs"
    | "service-request-docs"
    | "delivery-docs"
    | "purchase-orders"
    | "commercial-docs"
    | "compliance-docs";
  groupLabel?: string;
}

export type DocumentGroupKey =
  | "requirements-docs"
  | "service-request-docs"
  | "delivery-docs"
  | "purchase-orders"
  | "commercial-docs"
  | "compliance-docs";

export interface CustomerGroupedDocumentsPayload {
  metrics: {
    total: number;
    pageCount: number;
    byGroup: Record<DocumentGroupKey, number>;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
  filters: {
    selectedGroup: DocumentGroupKey | null;
    availableGroups: Array<{
      key: DocumentGroupKey;
      label: string;
    }>;
  };
  documents: DocumentRecord[];
}

export async function listDocuments(input: { bucket: string; prefix: string }) {
  const supabase = createClient();
  const prefixPattern = input.prefix ? `${input.prefix}/%` : "%";
  const { data, error } = await supabase
    .from("documents")
    .select("file_name, path, size_bytes, created_at, updated_at, metadata")
    .eq("bucket", input.bucket)
    .like("path", prefixPattern)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      file_name: string;
      path: string;
      size_bytes: number | null;
      created_at: string | null;
      updated_at: string | null;
      metadata: {
        documentType?: unknown;
        documentTypeLabel?: unknown;
      } | null;
    }>
  ).map((item) => ({
    name: item.file_name,
    path: item.path,
    size: item.size_bytes ?? undefined,
    createdAt: item.created_at ?? undefined,
    updatedAt: item.updated_at ?? undefined,
    documentType:
      typeof item.metadata?.documentType === "string"
        ? item.metadata.documentType
        : undefined,
    documentTypeLabel:
      typeof item.metadata?.documentTypeLabel === "string"
        ? item.metadata.documentTypeLabel
        : undefined,
  }));
}

export async function listCustomerDocumentsGrouped(input: {
  organizationId: string;
  bucket: string;
  prefix: string;
  group?: DocumentGroupKey;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams({
    organizationId: input.organizationId,
    bucket: input.bucket,
    prefix: input.prefix,
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 15),
  });

  if (input.group) {
    params.set("group", input.group);
  }

  const response = await fetch(`/api/customer/documents?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & Partial<CustomerGroupedDocumentsPayload>)
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "Could not load customer documents.");
  }

  return {
    metrics: {
      total: body?.metrics?.total ?? 0,
      pageCount: body?.metrics?.pageCount ?? 0,
      byGroup: body?.metrics?.byGroup ?? {
        "requirements-docs": 0,
        "service-request-docs": 0,
        "delivery-docs": 0,
        "purchase-orders": 0,
        "commercial-docs": 0,
        "compliance-docs": 0,
      },
    },
    pagination: {
      page: body?.pagination?.page ?? 1,
      pageSize: body?.pagination?.pageSize ?? 15,
      total: body?.pagination?.total ?? 0,
      totalPages: body?.pagination?.totalPages ?? 1,
      hasPrevPage: body?.pagination?.hasPrevPage ?? false,
      hasNextPage: body?.pagination?.hasNextPage ?? false,
    },
    filters: {
      selectedGroup: body?.filters?.selectedGroup ?? null,
      availableGroups: body?.filters?.availableGroups ?? [],
    },
    documents: body?.documents ?? [],
  } satisfies CustomerGroupedDocumentsPayload;
}

export async function uploadDocument(input: {
  bucket: string;
  path: string;
  file: File;
  documentType?: string;
  documentTypeLabel?: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "You must be signed in to upload.");
  }

  const { data, error } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, input.file, { upsert: false });

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        `Bucket "${input.bucket}" not found. Create this bucket in Supabase Storage or set NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET to an existing bucket.`,
      );
    }
    throw error;
  }

  const fileName = input.path.split("/").pop() ?? input.file.name;
  const organizationId = await resolveValidOrganizationId(supabase, input.path);
  const metadata: Record<string, unknown> = {};
  if (input.documentType) {
    metadata.documentType = input.documentType;
  }
  if (input.documentTypeLabel) {
    metadata.documentTypeLabel = input.documentTypeLabel;
  }

  const { error: metadataError } = await supabase.from("documents").insert({
    uploaded_by: user.id,
    organization_id: organizationId,
    bucket: input.bucket,
    path: input.path,
    file_name: fileName,
    mime_type: input.file.type || null,
    size_bytes: input.file.size,
    metadata,
  });

  if (metadataError) {
    await supabase.storage.from(input.bucket).remove([input.path]);
    throw metadataError;
  }

  return data;
}

export async function createSignedDocumentUrl(input: {
  bucket: string;
  path: string;
  expiresIn?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .createSignedUrl(input.path, input.expiresIn ?? 120);

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        `Bucket "${input.bucket}" not found. Create this bucket in Supabase Storage or set NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET to an existing bucket.`,
      );
    }
    throw error;
  }

  return data.signedUrl;
}

export async function removeDocument(input: { bucket: string; path: string }) {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(input.bucket)
    .remove([input.path]);

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        `Bucket "${input.bucket}" not found. Create this bucket in Supabase Storage or set NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET to an existing bucket.`,
      );
    }
    throw error;
  }

  const { error: metadataError } = await supabase
    .from("documents")
    .delete()
    .eq("bucket", input.bucket)
    .eq("path", input.path);

  if (metadataError) {
    throw metadataError;
  }
}

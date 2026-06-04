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
}

export async function listDocuments(input: { bucket: string; prefix: string }) {
  const supabase = createClient();
  const prefixPattern = input.prefix ? `${input.prefix}/%` : "%";
  const { data, error } = await supabase
    .from("documents")
    .select("file_name, path, size_bytes, created_at, updated_at")
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
    }>
  ).map((item) => ({
    name: item.file_name,
    path: item.path,
    size: item.size_bytes ?? undefined,
    createdAt: item.created_at ?? undefined,
    updatedAt: item.updated_at ?? undefined,
  }));
}

export async function uploadDocument(input: {
  bucket: string;
  path: string;
  file: File;
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
  const { error: metadataError } = await supabase.from("documents").insert({
    uploaded_by: user.id,
    organization_id: organizationId,
    bucket: input.bucket,
    path: input.path,
    file_name: fileName,
    mime_type: input.file.type || null,
    size_bytes: input.file.size,
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

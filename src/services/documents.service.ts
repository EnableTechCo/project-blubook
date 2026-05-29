import { createClient } from "@/lib/supabase/browser";

export interface DocumentRecord {
  name: string;
  path: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function listDocuments(input: { bucket: string; prefix: string }) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .list(input.prefix, {
      limit: 200,
      sortBy: { column: "updated_at", order: "desc" },
    });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    name: item.name,
    path: input.prefix ? `${input.prefix}/${item.name}` : item.name,
    size: item.metadata?.size,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })) as DocumentRecord[];
}

export async function uploadDocument(input: {
  bucket: string;
  path: string;
  file: File;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, input.file, { upsert: false });

  if (error) {
    throw error;
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
    throw error;
  }
}

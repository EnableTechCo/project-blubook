import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";

export interface ProviderContext {
  admin: ReturnType<typeof createAdminClient>;
  providerId: string;
}

export interface ProviderContextError {
  error: string;
  status: number;
}

/**
 * Resolve the signed-in user to the service provider they act for.
 *
 * Shared by every provider work-order route so the identity rule lives in one
 * place: without it each route would re-derive the partner link and could
 * drift apart on who is allowed to touch an item.
 */
export async function resolveProviderContext(): Promise<
  ProviderContext | ProviderContextError
> {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401 };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("metadata, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const providerId = await resolveServicePartnerIdForPartnerUser({
    admin,
    userId: user.id,
    profileMetadata: profile?.metadata,
    profileOrganizationId: profile?.organization_id ?? null,
    userMetadata: user.user_metadata,
  });

  if (!providerId) {
    return { error: "You are not linked to a service provider.", status: 403 };
  }

  return { admin, providerId };
}

export function isProviderContextError(
  value: ProviderContext | ProviderContextError,
): value is ProviderContextError {
  return "error" in value;
}

import { requireAdminApi } from "@/lib/auth/require-admin";

// Admin/staff guard for the catalog config routes.
//
// Kept as a named re-export so the catalog routes read as before; the check
// itself now lives in lib/auth so every admin route can share one
// implementation rather than each re-declaring the role lookup.
export async function requireCatalogAdmin() {
  return requireAdminApi();
}

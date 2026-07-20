import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCustomerEntitlements } from "./entitlements.service";

type Result = { data?: unknown; error?: { message: string } | null };

// Thenable query builder: chain methods return itself; resolves (await or
// maybeSingle) to a canned result for the table.
function makeQuery(result: Result) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    is: () => q,
    order: () => q,
    limit: () => q,
    in: () => q,
    maybeSingle: async () => result,
    then: (resolve: (v: Result) => unknown) => resolve(result),
  };
  return q;
}

function mockAdmin(byTable: Record<string, Result>): SupabaseClient {
  return {
    from: (table: string) => makeQuery(byTable[table] ?? { data: [], error: null }),
  } as unknown as SupabaseClient;
}

const happyPath: Record<string, Result> = {
  user_profiles: { data: { organization_id: "org1" }, error: null },
  subscriptions: { data: { package_id: "pkg1" }, error: null },
  package_services: { data: [{ service_id: "s1" }], error: null },
  services: { data: [{ id: "s1", key: "Sales Ops", name: "Sales Ops" }], error: null },
  catalog_items: {
    data: [{ id: "i1", service_id: "s1", item_key: "buy", label: "Buy", description: null }],
    error: null,
  },
  catalog_item_dependencies: {
    data: [{ id: "e1", catalog_item_id: "i1", depends_on_item_id: "i2" }],
    error: null,
  },
};

describe("resolveCustomerEntitlements", () => {
  it("resolves customer -> org -> package -> menu + dependencies", async () => {
    const result = await resolveCustomerEntitlements(mockAdmin(happyPath), {
      customerId: "c1",
    });

    expect(result.packageId).toBe("pkg1");
    expect(result.services).toEqual([
      {
        id: "s1",
        key: "Sales Ops",
        name: "Sales Ops",
        items: [{ id: "i1", item_key: "buy", label: "Buy", description: null }],
      },
    ]);
    expect(result.dependencies).toEqual([
      { id: "e1", catalog_item_id: "i1", depends_on_item_id: "i2" },
    ]);
  });

  it("returns empty entitlements when the customer has no organization", async () => {
    const result = await resolveCustomerEntitlements(
      mockAdmin({ ...happyPath, user_profiles: { data: null, error: null } }),
      { customerId: "c1" },
    );
    expect(result).toEqual({ packageId: null, services: [], dependencies: [] });
  });

  it("returns empty entitlements when there is no active subscription", async () => {
    const result = await resolveCustomerEntitlements(
      mockAdmin({ ...happyPath, subscriptions: { data: null, error: null } }),
      { customerId: "c1" },
    );
    expect(result).toEqual({ packageId: null, services: [], dependencies: [] });
  });
});

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkRequest } from "./work-request.service";

type Result = { data?: unknown; error?: { message: string } | null };

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

// Entitlements chain that yields a package whose menu contains item "i1".
const entitledToI1: Record<string, Result> = {
  user_profiles: { data: { organization_id: "org1" }, error: null },
  subscriptions: { data: { package_id: "pkg1" }, error: null },
  package_services: { data: [{ service_id: "s1" }], error: null },
  services: { data: [{ id: "s1", key: "Sales Ops", name: "Sales Ops" }], error: null },
  catalog_items: {
    data: [{ id: "i1", service_id: "s1", item_key: "buy", label: "Buy", description: null }],
    error: null,
  },
  catalog_item_dependencies: { data: [], error: null },
};

const UUID_A = "11111111-1111-4111-8111-111111111111";

describe("createWorkRequest (guards)", () => {
  it("rejects an empty selection with 400", async () => {
    const res = await createWorkRequest(mockAdmin({}), {
      customerId: "c1",
      selectedCatalogItemIds: [],
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects when the customer has no active subscription with 409", async () => {
    const res = await createWorkRequest(
      mockAdmin({
        user_profiles: { data: { organization_id: "org1" }, error: null },
        subscriptions: { data: null, error: null },
      }),
      { customerId: "c1", selectedCatalogItemIds: [UUID_A] },
    );
    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it("rejects a pick that isn't in the customer's package with 400", async () => {
    // Menu only has "i1"; the customer tries to request "i2".
    const res = await createWorkRequest(entitledAdmin(), {
      customerId: "c1",
      selectedCatalogItemIds: ["i2"],
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });
});

function entitledAdmin() {
  return mockAdmin(entitledToI1);
}

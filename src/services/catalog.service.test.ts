import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPackageCatalog } from "./catalog.service";

type QueryResult = { data?: unknown; error?: { message: string } | null };

// A thenable query builder whose chain methods all return itself and which
// resolves to a canned result when awaited — enough to exercise the service's
// query chains (.select/.eq/.in/.order).
function makeQuery(result: QueryResult) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    then: (resolve: (value: QueryResult) => unknown) => resolve(result),
  };
  return q;
}

function mockAdmin(resultsByTable: Record<string, QueryResult>): SupabaseClient {
  return {
    from: (table: string) => makeQuery(resultsByTable[table] ?? { data: [] }),
  } as unknown as SupabaseClient;
}

describe("getPackageCatalog", () => {
  it("groups active catalog items under their services", async () => {
    const admin = mockAdmin({
      package_services: { data: [{ service_id: "s1" }, { service_id: "s2" }], error: null },
      services: {
        data: [
          { id: "s1", key: "Sales Ops", name: "Sales Ops" },
          { id: "s2", key: "Logistics", name: "Logistics" },
        ],
        error: null,
      },
      catalog_items: {
        data: [
          { id: "i1", service_id: "s1", item_key: "buy-goods", label: "Buy Goods", description: null },
          { id: "i2", service_id: "s2", item_key: "deliver", label: "Deliver", description: "ship it" },
        ],
        error: null,
      },
    });

    const result = await getPackageCatalog(admin, "pkg-1");

    expect(result).toEqual([
      {
        id: "s1",
        key: "Sales Ops",
        name: "Sales Ops",
        items: [{ id: "i1", item_key: "buy-goods", label: "Buy Goods", description: null }],
      },
      {
        id: "s2",
        key: "Logistics",
        name: "Logistics",
        items: [{ id: "i2", item_key: "deliver", label: "Deliver", description: "ship it" }],
      },
    ]);
  });

  it("returns a service with an empty item list when it has no items", async () => {
    const admin = mockAdmin({
      package_services: { data: [{ service_id: "s1" }], error: null },
      services: { data: [{ id: "s1", key: "Legal", name: "Legal" }], error: null },
      catalog_items: { data: [], error: null },
    });

    const result = await getPackageCatalog(admin, "pkg-1");
    expect(result).toEqual([{ id: "s1", key: "Legal", name: "Legal", items: [] }]);
  });

  it("returns an empty catalog when the package includes no services", async () => {
    const admin = mockAdmin({
      package_services: { data: [], error: null },
    });

    const result = await getPackageCatalog(admin, "pkg-empty");
    expect(result).toEqual([]);
  });
});

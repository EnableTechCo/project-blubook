import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCatalogAdmin } from "../auth";
import { listCatalogItemDependencies } from "@/services/catalog.service";
import { wouldCreateCycle } from "@/features/catalog/dependency-graph";

const createSchema = z.object({
  catalogItemId: z.string().uuid(),
  dependsOnItemId: z.string().uuid(),
});

// Add a dependency edge (catalogItemId depends on dependsOnItemId). Guarded
// by the acyclic validator (P1-4): an edge that would close a cycle is
// rejected with 409 before it is written.
export async function POST(request: Request) {
  try {
    const auth = await requireCatalogAdmin();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const body = createSchema.parse(await request.json());

    if (body.catalogItemId === body.dependsOnItemId) {
      return NextResponse.json(
        { error: "An item cannot depend on itself." },
        { status: 409 },
      );
    }

    const existing = await listCatalogItemDependencies(admin);
    const edges = existing.map((e) => ({
      catalogItemId: e.catalog_item_id,
      dependsOnItemId: e.depends_on_item_id,
    }));

    if (
      wouldCreateCycle(edges, {
        catalogItemId: body.catalogItemId,
        dependsOnItemId: body.dependsOnItemId,
      })
    ) {
      return NextResponse.json(
        { error: "That dependency would create a cycle." },
        { status: 409 },
      );
    }

    const { data, error } = await admin
      .from("catalog_item_dependencies")
      .insert({
        catalog_item_id: body.catalogItemId,
        depends_on_item_id: body.dependsOnItemId,
      })
      .select("id, catalog_item_id, depends_on_item_id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That dependency already exists." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dependency: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not add the dependency.",
      },
      { status: 500 },
    );
  }
}

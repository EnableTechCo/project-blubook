import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCatalogAdmin } from "../../auth";

// Edit a catalog item's label/description or (de)activate it. item_key is
// immutable — it's the stable reference dependencies and instances point at.
const patchSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No changes provided.",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCatalogAdmin();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.label !== undefined) update.label = body.label;
    if (body.description !== undefined) update.description = body.description;
    if (body.isActive !== undefined) update.is_active = body.isActive;

    const { data, error } = await admin
      .from("catalog_items")
      .update(update)
      .eq("id", id)
      .select("id, service_id, item_key, label, description, is_active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    return NextResponse.json({ item: data });
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
          error instanceof Error ? error.message : "Could not update the item.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCatalogAdmin } from "../auth";

const createSchema = z.object({
  serviceId: z.string().uuid(),
  label: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

// Stable slug from a label, e.g. "Quotation Generation" -> "quotation-generation".
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Create a catalog item under a service.
export async function POST(request: Request) {
  try {
    const auth = await requireCatalogAdmin();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const body = createSchema.parse(await request.json());

    const itemKey = slugify(body.label);
    if (!itemKey) {
      return NextResponse.json(
        { error: "Label must contain at least one letter or number." },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("catalog_items")
      .insert({
        service_id: body.serviceId,
        item_key: itemKey,
        label: body.label,
        description: body.description ?? null,
      })
      .select("id, service_id, item_key, label, description, is_active")
      .single();

    if (error) {
      // Unique (service_id, item_key) violation -> friendly conflict.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "An item with this name already exists for this service." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
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
          error instanceof Error ? error.message : "Could not create the item.",
      },
      { status: 500 },
    );
  }
}

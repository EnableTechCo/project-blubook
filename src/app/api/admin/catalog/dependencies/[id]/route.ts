import { NextResponse } from "next/server";
import { requireCatalogAdmin } from "../../auth";

// Remove a dependency edge.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCatalogAdmin();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const { id } = await params;

    const { data, error } = await admin
      .from("catalog_item_dependencies")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Dependency not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not remove the dependency.",
      },
      { status: 500 },
    );
  }
}

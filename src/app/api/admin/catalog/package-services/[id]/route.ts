import { NextResponse } from "next/server";
import { requireCatalogAdmin } from "../../auth";

// Remove a service from a package (deletes the link row).
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
      .from("package_services")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Package-service link not found." },
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
            : "Could not remove the service from the package.",
      },
      { status: 500 },
    );
  }
}

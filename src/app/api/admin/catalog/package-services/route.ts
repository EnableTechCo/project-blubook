import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCatalogAdmin } from "../auth";

const createSchema = z.object({
  packageId: z.string().uuid(),
  serviceId: z.string().uuid(),
});

// Add a service to a package. Idempotent-friendly: a duplicate link returns
// a 409 rather than a raw constraint error.
export async function POST(request: Request) {
  try {
    const auth = await requireCatalogAdmin();
    if ("error" in auth) return auth.error;

    const { admin } = auth;
    const body = createSchema.parse(await request.json());

    const { data, error } = await admin
      .from("package_services")
      .insert({ package_id: body.packageId, service_id: body.serviceId })
      .select("id, package_id, service_id, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This service is already on the package." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ packageService: data }, { status: 201 });
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
            : "Could not add the service to the package.",
      },
      { status: 500 },
    );
  }
}

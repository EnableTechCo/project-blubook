import { NextResponse } from "next/server";
import { requireCatalogAdmin } from "./auth";
import {
  listCatalogItemDependencies,
  listCatalogItems,
  listServices,
} from "@/services/catalog.service";

// Full catalog for the admin config UI: every service, every item (incl.
// inactive so admins can re-activate), the dependency edges, and the
// package -> service links.
export async function GET() {
  try {
    const auth = await requireCatalogAdmin();
    if ("error" in auth) return auth.error;

    const { admin } = auth;

    const [services, items, dependencies, packageServicesRes] =
      await Promise.all([
        listServices(admin, { includeInactive: true }),
        listCatalogItems(admin, { includeInactive: true }),
        listCatalogItemDependencies(admin),
        admin
          .from("package_services")
          .select("id, package_id, service_id, is_active"),
      ]);

    if (packageServicesRes.error) {
      return NextResponse.json(
        { error: packageServicesRes.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      services,
      items,
      dependencies,
      packageServices: packageServicesRes.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load the catalog.",
      },
      { status: 500 },
    );
  }
}

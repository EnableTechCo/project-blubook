import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkRequest } from "@/services/work-request.service";
import { resolveCustomerWorkRequestMenu } from "@/services/entitlements.service";

const bodySchema = z.object({
  selectedCatalogItemIds: z.array(z.string().uuid()).min(1),
});

// The customer's deterministic work-order menu: the services their package
// grants, the dependency edges, and a directory to name auto-included items.
export async function GET() {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const menu = await resolveCustomerWorkRequestMenu(admin, {
      customerId: user.id,
    });

    return NextResponse.json(menu);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load your menu.",
      },
      { status: 500 },
    );
  }
}

// Customer submits a catalog selection; the system expands it into a
// work-request graph, discloses what it auto-included, and returns the result.
export async function POST(request: Request) {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    const admin = createAdminClient();

    const result = await createWorkRequest(admin, {
      customerId: user.id,
      selectedCatalogItemIds: body.selectedCatalogItemIds,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        workRequestId: result.workRequestId,
        itemCount: result.itemCount,
        readyCount: result.readyCount,
        autoIncluded: result.autoIncluded,
      },
      { status: 201 },
    );
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
            : "Could not create the request.",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCustomerWorkRequests } from "@/services/work-request-timeline.service";

// The customer's own work requests (Phase 4, P4-4).
//
// Kept separate from the collection GET, which serves the selection menu: the
// two are read at different times and there is no reason to make choosing new
// work pay for loading past requests.
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
    const requests = await listCustomerWorkRequests(admin, {
      customerId: user.id,
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load your requests.",
      },
      { status: 500 },
    );
  }
}

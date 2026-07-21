import { NextResponse } from "next/server";
import { listProviderWorkOrders } from "@/services/provider-work-orders.service";
import {
  isProviderContextError,
  resolveProviderContext,
} from "./partner-auth";

// The provider's own work orders (Phase 3, P3-5).
//
// Scoped to the provider the caller acts for, and anonymized — no customer or
// organization is exposed.
export async function GET(request: Request) {
  try {
    const context = await resolveProviderContext();
    if (isProviderContextError(context)) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const includeCompleted =
      new URL(request.url).searchParams.get("includeCompleted") === "true";

    const workOrders = await listProviderWorkOrders(context.admin, {
      providerId: context.providerId,
      includeCompleted,
    });

    return NextResponse.json({ workOrders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load your work orders.",
      },
      { status: 500 },
    );
  }
}

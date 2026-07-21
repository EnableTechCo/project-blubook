import { NextResponse } from "next/server";
import { acceptWorkOrderItem } from "@/services/provider-work-orders.service";
import {
  isProviderContextError,
  resolveProviderContext,
} from "../../partner-auth";

// A provider accepts an assigned work order and starts work (Phase 3, P3-5).
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const provider = await resolveProviderContext();
    if (isProviderContextError(provider)) {
      return NextResponse.json(
        { error: provider.error },
        { status: provider.status },
      );
    }

    const { id } = await context.params;
    const result = await acceptWorkOrderItem(provider.admin, {
      workRequestItemId: id,
      expectedProviderId: provider.providerId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }

    return NextResponse.json({ status: "in_progress" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not accept the work order.",
      },
      { status: 500 },
    );
  }
}

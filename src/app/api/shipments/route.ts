import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message:
      "Shipments API scaffolded. Implement logistics workflow transitions in Phase 3.",
  });
}

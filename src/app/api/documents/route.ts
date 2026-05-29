import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message:
      "Documents API scaffolded. Integrate storage, signed URLs and policy checks in Phase 2.",
  });
}

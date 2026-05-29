import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message:
      "Messages API scaffolded. Connect to Realtime and attachments in Phase 2.",
  });
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Auth route scaffolded. Implement login/session flows using Supabase Auth callbacks."
  });
}

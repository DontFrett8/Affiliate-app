import { NextResponse, type NextRequest } from "next/server";
import { disconnect } from "@/lib/platforms/pinterest";

export async function POST(req: NextRequest) {
  await disconnect();
  return NextResponse.redirect(new URL("/settings?pinterest=disconnected", req.url), { status: 303 });
}

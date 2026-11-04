import { NextResponse, type NextRequest } from "next/server";
import { publishDuePins } from "@/lib/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Publishes due pins. Call it every 5–15 minutes.
 * Auth: `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends) or `?key=<CRON_SECRET>` (for cron-job.org).
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  const header = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  if (header !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await publishDuePins();
  return NextResponse.json({ ran_at: new Date().toISOString(), processed: results.length, results });
}

export const GET = handle;
export const POST = handle;

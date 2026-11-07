import { NextResponse, type NextRequest } from "next/server";
import { amazonImageAtSize, isAmazonImageUrl } from "@/lib/amazon";

export const dynamic = "force-dynamic";

/**
 * Owner-only (behind login): returns a large version of an Amazon product photo so the browser
 * can save or share it. Only Amazon image hosts are allowed, so this is not an open proxy.
 */
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("u") ?? "";
  if (!isAmazonImageUrl(src)) return NextResponse.json({ error: "Not an Amazon image" }, { status: 400 });
  for (const url of [amazonImageAtSize(src, 1500)!, src]) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) continue;
      return new NextResponse(await res.arrayBuffer(), {
        headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400" },
      });
    } catch {
      /* try the next size */
    }
  }
  return NextResponse.json({ error: "Couldn't fetch that image" }, { status: 502 });
}

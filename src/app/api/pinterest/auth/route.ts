import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeUrl, callbackUrl } from "@/lib/platforms/pinterest";

export async function GET(req: NextRequest) {
  try {
    const state = crypto.randomUUID();
    (await cookies()).set("pf_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
    return NextResponse.redirect(buildAuthorizeUrl(callbackUrl(req.nextUrl.origin), state));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/settings?pinterest=error&msg=${encodeURIComponent(msg)}`, req.url));
  }
}

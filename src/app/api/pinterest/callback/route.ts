import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, exchangeCode } from "@/lib/platforms/pinterest";
import { isAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?${q}`, req.url));

  if (!(await isAuthenticated())) return NextResponse.redirect(new URL("/login?next=/settings", req.url));
  if (error) return back(`pinterest=error&msg=${encodeURIComponent(error)}`);
  const store = await cookies();
  const expected = store.get("pf_oauth_state")?.value;
  store.delete("pf_oauth_state");
  if (!code || !state || state !== expected) return back("pinterest=error&msg=Invalid+OAuth+state.+Try+again.");

  try {
    await exchangeCode(code, callbackUrl(url.origin));
    return back("pinterest=connected");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return back(`pinterest=error&msg=${encodeURIComponent(msg)}`);
  }
}

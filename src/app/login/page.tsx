import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSessionToken, isAuthenticated, passwordMatches, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await isAuthenticated()) redirect("/");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";

  async function login(formData: FormData) {
    "use server";
    const pw = String(formData.get("password") ?? "");
    const dest = String(formData.get("next") ?? "/");
    if (!passwordMatches(pw)) redirect(`/login?error=1&next=${encodeURIComponent(dest)}`);
    const store = await cookies();
    store.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
    redirect(dest.startsWith("/") ? dest : "/");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-2xl text-white">P</div>
        <h1 className="text-2xl font-bold">PinFlow</h1>
        <p className="text-sm text-muted">Amazon finds → Pinterest, on autopilot.</p>
      </div>
      <form action={login} className="card space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" autoFocus required />
        {error && <p className="text-sm text-accent">Wrong password.</p>}
        <button className="btn-primary w-full" type="submit">Sign in</button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">Single-user app. The password is the APP_PASSWORD environment variable.</p>
    </main>
  );
}

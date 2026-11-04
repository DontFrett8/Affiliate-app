import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeControls";
import { getThemePref } from "@/lib/theme";
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
    <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center overflow-hidden px-6 py-12">
      <div className="absolute right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-10"><ThemeToggle initial={await getThemePref()} /></div>
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-accent-2/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="animate-rise relative mb-8 text-center">
        <div className="mx-auto mb-5 w-fit rounded-[1.4rem] shadow-[0_18px_40px_-16px_rgb(230_0_35/0.6)]">
          <Logo size={72} />
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Pin<span className="italic text-accent">flow</span>
        </h1>
        <p className="font-display mt-2 text-lg italic text-muted">Your Amazon finds, beautifully pinned.</p>
      </div>
      <form action={login} className="card animate-rise relative space-y-4 bg-card/90 backdrop-blur">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" className="input" autoFocus required />
        </div>
        {error && <p className="notice notice-err !py-2.5">That password didn&apos;t match. Try again.</p>}
        <button className="btn-primary w-full !py-3 text-base" type="submit">Sign in</button>
      </form>
      <p className="relative mt-6 text-center text-xs text-muted">A private studio for one. ✿</p>
    </main>
  );
}

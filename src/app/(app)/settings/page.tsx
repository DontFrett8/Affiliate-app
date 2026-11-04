import { asc } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { createPinterestBoard } from "@/actions/pins";
import { addCategory, deleteCategory, moveCategory, restoreDefaultCategories, saveSettings, updateCategory } from "@/actions/settings";
import { callbackUrl, getConnection, pinterestEnv } from "@/lib/platforms/pinterest";
import { getPublisher, pinterestRoute } from "@/lib/platforms";
import { makeConfig } from "@/lib/platforms/make";
import { MakeSetup } from "@/components/MakeSetup";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { PageHeader } from "@/components/PageHeader";
import { LogOut } from "lucide-react";
import { AppearancePicker } from "@/components/ThemeControls";
import { getThemePref } from "@/lib/theme";
import { formatLocal, nowMs } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const s = await getSettings();
  const themePref = await getThemePref();
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  const conn = await getConnection();
  const route = await pinterestRoute();
  const boards = route !== "none" ? await getPublisher("pinterest").listBoards().catch(() => conn?.boards ?? s.makeBoards ?? []) : [];
  const mk = makeConfig();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const redirect = callbackUrl(origin);
  const cronUrl = `${process.env.APP_URL?.replace(/\/$/, "") || origin}/api/cron/publish`;
  const env = {
    canopy: !!process.env.CANOPY_API_KEY,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    cron: !!process.env.CRON_SECRET,
    pinterest: !!process.env.PINTEREST_APP_ID && !!process.env.PINTEREST_APP_SECRET,
  };
  const cronAgeMin = s.lastCronAt ? Math.round((nowMs() - s.lastCronAt.getTime()) / 60000) : null;
  const cronHealthy = cronAgeMin !== null && cronAgeMin <= 20;
  const flash = typeof sp.pinterest === "string" ? sp.pinterest : null;
  const flashMsg = typeof sp.msg === "string" ? sp.msg : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your studio"
        title={<>Settings &amp; <span className="italic text-accent">style</span></>}
        action={<form action="/api/auth/logout" method="post"><button className="btn-secondary !px-3.5 !py-2 !text-xs"><LogOut size={13} /> Sign out</button></form>}
      />

      {/* Appearance */}
      <section className="card space-y-3">
        <h2 className="section-title">Appearance</h2>
        <AppearancePicker initial={themePref} />
        <p className="text-xs text-muted">The sun/moon button at the top of every screen switches quickly too.</p>
      </section>

      {/* Pinterest */}
      <section className="card space-y-3">
        <h2 className="section-title">Pinterest</h2>
        {flash === "connected" && <p className="notice notice-ok">Pinterest connected. You&apos;re ready to post.</p>}
        {flash === "disconnected" && <p className="notice notice-info">Disconnected.</p>}
        {flash === "error" && <p className="notice notice-err">Pinterest error: {flashMsg}</p>}
        {conn ? (
          <>
            <p className="text-sm">
              Connected as <strong>@{conn.accountName ?? "unknown"}</strong> · {conn.environment} API · {boards.length} boards
              {conn.accessExpiresAt && <> · token renews {formatLocal(conn.accessExpiresAt, s.timezone, "MMM d")}</>}
            </p>
            {sp.board === "created" && <p className="notice notice-ok">Board created.</p>}
            {sp.board === "error" && <p className="notice notice-err">Couldn&apos;t create board: {flashMsg}</p>}
            <form action={createPinterestBoard} className="flex gap-2">
              <input name="name" className="input" placeholder="New board name (sandbox starts empty)" required />
              <select name="privacy" className="input !w-auto" defaultValue="PUBLIC"><option value="PUBLIC">Public</option><option value="SECRET">Secret</option></select>
              <button className="btn-secondary shrink-0">Create</button>
            </form>
            <div className="flex gap-2">
              <a href="/api/pinterest/auth" className="btn-secondary">Reconnect</a>
              <form action="/api/pinterest/disconnect" method="post"><button className="btn-ghost text-danger-ink">Disconnect</button></form>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Connect once; tokens are stored encrypted and refreshed automatically.</p>
            <a href={env.pinterest ? "/api/pinterest/auth" : "#"} className={`btn-primary ${env.pinterest ? "" : "pointer-events-none opacity-50"}`}>Connect Pinterest</a>
            {!env.pinterest && <p className="text-xs text-warn-ink">Set PINTEREST_APP_ID and PINTEREST_APP_SECRET first.</p>}
          </>
        )}
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Pinterest app setup details</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Redirect URI to register in your Pinterest app: <code className="select-all break-all">{redirect}</code></li>
            <li>Mode: <strong>{pinterestEnv()}</strong> (env var <code>PINTEREST_ENV</code>; set to <code>production</code> after Standard access is approved)</li>
            <li>Scopes requested: boards:read, pins:read, pins:write, user_accounts:read</li>
            <li>Privacy policy URL for the app listing: <code className="select-all break-all">{origin}/privacy</code></li>
          </ul>
        </details>
      </section>

      {/* Make.com bridge */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">Make.com bridge</h2>
          <span className={`badge ${route === "make" ? "bg-success-soft text-success-ink" : route === "direct" ? "bg-card-2 text-muted ring-1 ring-border" : "bg-warn-soft text-warn-ink"}`}>
            {route === "make" ? "Posting through Make" : route === "direct" ? "Standby (Pinterest connected)" : "Not set up"}
          </span>
        </div>
        <p className="text-sm text-muted">
          Until Pinterest approves your app, PinFlow can post through Make.com&apos;s Pinterest connection. When you connect Pinterest above, PinFlow switches to direct posting automatically and Make stops being used.
        </p>
        <MakeSetup postUrl={!!mk.postUrl} boardsUrl={!!mk.boardsUrl} keyValue={mk.key ?? null} boardCount={s.makeBoards?.length ?? 0} active={route === "make"} />
      </section>

      {/* General settings */}
      <form action={saveSettings} className="card space-y-4">
        <h2 className="section-title">Defaults</h2>
        <div>
          <label className="label" htmlFor="associateTag">Amazon Associate tag</label>
          <input id="associateTag" name="associateTag" className="input" defaultValue={s.associateTag} placeholder="yourname-20" autoCapitalize="off" />
          <p className="mt-1 text-xs text-muted">Links are built as https://www.amazon.com/dp/ASIN?tag=…</p>
        </div>
        <div>
          <label className="label" htmlFor="defaultDestinationLink">Default destination link</label>
          <input id="defaultDestinationLink" name="defaultDestinationLink" className="input" inputMode="url" defaultValue={s.defaultDestinationLink} placeholder="https://www.amazon.com/shop/yourname" />
        </div>
        <div>
          <label className="label" htmlFor="dailyTimes">Daily post times (comma-separated, 24h)</label>
          <input id="dailyTimes" name="dailyTimes" className="input" defaultValue={s.dailyTimes.join(", ")} placeholder="09:00, 12:30, 17:00, 20:30" />
        </div>
        <div>
          <label className="label" htmlFor="timezone">Time zone</label>
          <input id="timezone" name="timezone" className="input" defaultValue={s.timezone} />
        </div>
        <div>
          <label className="label" htmlFor="defaultHashtags">Default hashtags</label>
          <input id="defaultHashtags" name="defaultHashtags" className="input" defaultValue={s.defaultHashtags} placeholder="#amazonfinds #founditonamazon" />
        </div>
        <div>
          <label className="label" htmlFor="disclosureText">Affiliate disclosure (required on every pin)</label>
          <textarea id="disclosureText" name="disclosureText" className="input" rows={2} defaultValue={s.disclosureText} />
        </div>
        <div>
          <label className="label" htmlFor="defaultBoardId">Default board</label>
          {boards.length ? (
            <select id="defaultBoardId" name="defaultBoardId" className="input" defaultValue={s.defaultBoardId ?? ""}>
              <option value="">—</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : (
            <input id="defaultBoardId" name="defaultBoardId" className="input" defaultValue={s.defaultBoardId ?? ""} placeholder="Connect Pinterest to choose" />
          )}
        </div>
        <button className="btn-primary w-full">Save defaults</button>
      </form>

      {/* Categories */}
      <section className="space-y-3">
        <h2 className="section-title px-1">Categories</h2>
        <p className="text-xs text-muted">
          Each category points at an Amazon Best Sellers page (URL, numeric node ID, or a slug like <code>bestsellers_beauty</code>). Use the browser to pick sub-categories exactly.
        </p>
        <CategoryBrowser categories={cats.map((c) => ({ id: c.id, name: c.name }))} canopyConfigured={env.canopy} />
        <ul className="space-y-2">
          {cats.map((c, i) => (
            <li key={c.id} className="card space-y-2.5 !p-4">
              <form action={updateCategory} className="space-y-2">
                <input type="hidden" name="id" value={c.id} />
                <div className="flex gap-2">
                  <input name="name" className="input" defaultValue={c.name} aria-label="Category name" />
                  <button className="btn-secondary shrink-0">Save</button>
                </div>
                <input name="amazonCategory" className="input !text-xs font-mono" defaultValue={c.amazonCategory} placeholder="https://www.amazon.com/gp/bestsellers/beauty/11058281" aria-label="Amazon category" />
                {c.amazonCategoryName && <p className="text-xs text-success-ink">Amazon: {c.amazonCategoryName}</p>}
                {c.lastError && <p className="text-xs text-danger-ink">{c.lastError}</p>}
              </form>
              {c.childCategories && c.childCategories.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted">Sub-categories seen on last refresh ({c.childCategories.length})</summary>
                  <ul className="mt-1 space-y-1">
                    {c.childCategories.map((ch) => (
                      <li key={ch.url} className="flex items-center justify-between gap-2">
                        <span className="truncate">{ch.name}</span>
                        <form action={updateCategory}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="name" value={c.name} />
                          <input type="hidden" name="amazonCategory" value={ch.url} />
                          <button className="underline">use</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex items-center gap-3 text-xs">
                <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="up" /><button disabled={i === 0} className="underline disabled:opacity-30">↑</button></form>
                <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="down" /><button disabled={i === cats.length - 1} className="underline disabled:opacity-30">↓</button></form>
                <form action={deleteCategory} className="ml-auto"><input type="hidden" name="id" value={c.id} /><button className="text-danger-ink underline">Remove</button></form>
              </div>
            </li>
          ))}
        </ul>
        <form action={addCategory} className="card-tinted space-y-2.5">
          <strong className="font-display text-base">Add a category</strong>
          <input name="name" className="input" placeholder="Name (e.g. Candles)" required />
          <input name="amazonCategory" className="input !text-xs font-mono" placeholder="Amazon best-sellers URL (optional, can pick later)" />
          <button className="btn-secondary w-full">Add</button>
        </form>
        <form action={restoreDefaultCategories}><button className="text-xs underline text-muted">Restore any missing default categories</button></form>
      </section>

      {/* Automation */}
      <section className="card space-y-2 text-sm">
        <h2 className="section-title">Posting job</h2>
        <p className={`notice items-center ${cronHealthy ? "notice-ok" : "notice-warn"}`}>
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cronHealthy ? "bg-success-ink" : "bg-warn-ink"}`} />
          {s.lastCronAt
            ? <>Last check-in: <strong>{formatLocal(s.lastCronAt, s.timezone, "MMM d, h:mm a")}</strong> ({cronAgeMin} min ago){cronHealthy ? " · working" : " · no recent check-ins"}</>
            : <>No check-ins yet. The cron job hasn&apos;t reached PinFlow.</>}
        </p>
        <p className="text-muted">Pinterest has no scheduler, so something must call this URL every 5–15 minutes. On Vercel Hobby, a free cron-job.org job does it; on Vercel Pro the included <code>vercel.json</code> cron runs every 10 min automatically.</p>
        <p className="break-all rounded-2xl bg-card-2 p-3 font-mono text-xs">{cronUrl}?key=YOUR_CRON_SECRET</p>
        <p className="text-xs text-muted">Retries: failed pins are retried automatically on the next runs (up to 3 attempts); “Retry now” in the queue always works.</p>
      </section>

      {/* Env status */}
      <section className="card space-y-1 text-sm">
        <h2 className="section-title">Environment</h2>
        <Status ok={true} label="DATABASE_URL (you're seeing this page)" />
        <Status ok={env.canopy} label="CANOPY_API_KEY" />
        <Status ok={env.blob} label="BLOB_READ_WRITE_TOKEN" />
        <Status ok={env.cron} label="CRON_SECRET" />
        <Status ok={env.pinterest} label="PINTEREST_APP_ID + PINTEREST_APP_SECRET" />
        <p className="pt-2 text-xs text-muted">Set these in Vercel → Project → Settings → Environment Variables, then redeploy. <Link href="/privacy" className="underline">Privacy policy</Link></p>
      </section>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-success-ink" : "bg-danger-ink"}`} />
      <code>{label}</code>
    </p>
  );
}

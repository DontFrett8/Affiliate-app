import { desc, asc, sql } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/db";
import { pins } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { formatLocal, nowMs } from "@/lib/schedule";
import { deletePin, postPinNow, retryPin } from "@/actions/pins";
import { getConnection, pinterestEnv } from "@/lib/platforms/pinterest";

export const dynamic = "force-dynamic";
export const metadata = { title: "Queue" };

const statusStyle: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  posting: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  posted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  draft: "bg-stone-100 text-stone-700",
};

export default async function QueuePage() {
  const s = await getSettings();
  const conn = await getConnection();
  // Upcoming first (soonest at top), then history (latest first).
  const rows = await db
    .select()
    .from(pins)
    .orderBy(sql`case when ${pins.status} in ('scheduled','posting','failed') then 0 else 1 end`, asc(pins.scheduledAt), desc(pins.id));
  const upcoming = rows.filter((p) => p.status !== "posted");
  const history = rows.filter((p) => p.status === "posted").reverse();
  const now = nowMs();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Queue</h1>
          <p className="text-xs text-muted">
            {s.dailyTimes.join(" · ")} {s.timezone.replace("America/", "")} · Pinterest {conn ? `connected (${pinterestEnv()})` : "not connected"}
          </p>
        </div>
        <Link href="/pins/new" className="btn-primary">New pin</Link>
      </header>

      {!conn && (
        <p className="card border-amber-300 bg-amber-50 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Pins will fail to post until you <Link className="underline" href="/settings">connect Pinterest</Link>.
        </p>
      )}

      {upcoming.length === 0 && history.length === 0 && (
        <div className="card text-center text-sm text-muted">Nothing scheduled. Create your first pin.</div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Upcoming ({upcoming.length})</h2>
          <ul className="space-y-2">{upcoming.map((p) => <Row key={p.id} p={p} tz={s.timezone} now={now} />)}</ul>
        </section>
      )}
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Posted ({history.length})</h2>
          <ul className="space-y-2">{history.map((p) => <Row key={p.id} p={p} tz={s.timezone} now={now} />)}</ul>
        </section>
      )}
    </div>
  );
}

function Row({ p, tz, now }: { p: typeof pins.$inferSelect; tz: string; now: number }) {
  const overdue = p.status === "scheduled" && p.scheduledAt.getTime() < now - 20 * 60 * 1000;
  return (
    <li className="card flex gap-3 !p-3">
      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-background ring-1 ring-border">
        <Image src={p.imageUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`badge ${statusStyle[p.status] ?? ""}`}>{p.status}</span>
          <span className="text-xs text-muted">{formatLocal(p.status === "posted" && p.postedAt ? p.postedAt : p.scheduledAt, tz)}</span>
        </div>
        <p className="mt-1 truncate text-sm font-medium">{p.title}</p>
        <p className="truncate text-xs text-muted">{p.boardName ?? p.boardId}</p>
        {p.error && <p className="mt-1 line-clamp-3 text-xs text-red-600">{p.error}</p>}
        {overdue && !p.error && (
          <p className="mt-1 text-xs text-amber-700">Past due — is the cron job calling /api/cron/publish? See Settings.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {p.status === "posted" && p.externalUrl && (
            <a href={p.externalUrl} className="underline" target="_blank" rel="noopener noreferrer">View on Pinterest ↗</a>
          )}
          {p.status !== "posted" && <Link href={`/pins/${p.id}/edit`} className="underline">Edit</Link>}
          {p.status === "failed" && (
            <form action={retryPin}><input type="hidden" name="id" value={p.id} /><button className="underline">Retry now</button></form>
          )}
          {p.status === "scheduled" && (
            <form action={postPinNow}><input type="hidden" name="id" value={p.id} /><button className="underline">Post now</button></form>
          )}
          <form action={deletePin}><input type="hidden" name="id" value={p.id} /><button className="text-red-600 underline">Delete</button></form>
        </div>
      </div>
    </li>
  );
}

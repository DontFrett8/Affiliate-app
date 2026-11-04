import { desc, asc, sql } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { CalendarHeart, ExternalLink, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { db } from "@/db";
import { pins } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { formatLocal, nowMs } from "@/lib/schedule";
import { deletePin, postPinNow, retryPin } from "@/actions/pins";
import { pinterestEnv } from "@/lib/platforms/pinterest";
import { pinterestRoute } from "@/lib/platforms";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Queue" };

const statusStyle: Record<string, { cls: string; label: string }> = {
  draft: { cls: "bg-info-soft text-info-ink", label: "Draft" },
  scheduled: { cls: "bg-accent-soft text-accent-ink", label: "Scheduled" },
  posting: { cls: "bg-warn-soft text-warn-ink", label: "Posting…" },
  posted: { cls: "bg-success-soft text-success-ink", label: "Posted" },
  failed: { cls: "bg-danger-soft text-danger-ink", label: "Failed" },
};

type PinRow = typeof pins.$inferSelect;

function dayLabel(d: Date, tz: string, now: number) {
  const key = formatLocal(d, tz, "yyyy-MM-dd");
  const today = formatLocal(new Date(now), tz, "yyyy-MM-dd");
  const tomorrow = formatLocal(new Date(now + 86400000), tz, "yyyy-MM-dd");
  const yesterday = formatLocal(new Date(now - 86400000), tz, "yyyy-MM-dd");
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  if (key === yesterday) return "Yesterday";
  return formatLocal(d, tz, "EEEE, MMM d");
}

function groupByDay(rows: PinRow[], tz: string, now: number, pick: (p: PinRow) => Date) {
  const groups: { label: string; items: PinRow[] }[] = [];
  for (const p of rows) {
    const label = dayLabel(pick(p), tz, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(p);
    else groups.push({ label, items: [p] });
  }
  return groups;
}

export default async function QueuePage() {
  const s = await getSettings();
  const route = await pinterestRoute();
  const conn = route !== "none";
  const now = nowMs();
  const rows = await db
    .select()
    .from(pins)
    .orderBy(sql`case when ${pins.status} in ('scheduled','posting','failed','draft') then 0 else 1 end`, asc(pins.scheduledAt), desc(pins.id));
  const upcoming = rows.filter((p) => p.status !== "posted");
  const posted = rows.filter((p) => p.status === "posted").sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
  const drafts = upcoming.filter((p) => p.status === "draft").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your schedule"
        title={<>The <span className="italic text-accent">queue</span></>}
        subtitle={<>Posts at {s.dailyTimes.map((t) => formatLocal(new Date(`2000-01-01T${t}:00Z`), "UTC", "h:mm a")).join(" · ")}</>}
        action={<Link href="/pins/new" className="btn-primary !px-4"><Plus size={16} /> New</Link>}
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`badge !px-3 !py-1 ${conn ? "bg-success-soft text-success-ink" : "bg-warn-soft text-warn-ink"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${conn ? "bg-success-ink" : "bg-warn-ink"}`} /> {route === "direct" ? `Pinterest connected · ${pinterestEnv()}` : route === "make" ? "Posting via Make.com" : "Pinterest not connected"}
        </span>
        <span className="badge !px-3 !py-1 bg-card text-muted ring-1 ring-border">{upcoming.length} upcoming</span>
        <span className="badge !px-3 !py-1 bg-card text-muted ring-1 ring-border">{posted.length} posted</span>
      </div>

      {!conn && (
        <p className="notice notice-info">
          <span>
            Keep building drafts{drafts ? ` (${drafts} so far)` : ""}. Once you <Link className="font-semibold underline" href="/settings">connect Pinterest</Link>, open each draft and pick a board.
          </span>
        </p>
      )}

      {upcoming.length === 0 && posted.length === 0 && (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent-ink"><CalendarHeart size={28} /></span>
          <p className="font-display text-xl font-semibold">Your queue is empty</p>
          <p className="max-w-xs text-sm text-muted">Create your first pin and it will land in the next open time slot.</p>
          <Link href="/pins/new" className="btn-primary mt-1"><Plus size={16} /> Create a pin</Link>
        </div>
      )}

      {groupByDay(upcoming, s.timezone, now, (p) => p.scheduledAt).map((g) => (
        <section key={`u-${g.label}`} className="space-y-2.5">
          <h2 className="font-display px-1 text-lg font-semibold">{g.label}</h2>
          <ul className="space-y-2.5">{g.items.map((p) => <Row key={p.id} p={p} tz={s.timezone} now={now} />)}</ul>
        </section>
      ))}

      {posted.length > 0 && (
        <section className="space-y-2.5 pt-2">
          <p className="eyebrow px-1">Recently posted</p>
          <ul className="space-y-2.5">{posted.slice(0, 20).map((p) => <Row key={p.id} p={p} tz={s.timezone} now={now} />)}</ul>
        </section>
      )}
    </div>
  );
}

function Row({ p, tz, now }: { p: PinRow; tz: string; now: number }) {
  const overdue = p.status === "scheduled" && p.scheduledAt.getTime() < now - 20 * 60 * 1000;
  const draftLate = p.status === "draft" && p.scheduledAt.getTime() < now;
  const st = statusStyle[p.status] ?? statusStyle.scheduled;
  const when = p.status === "posted" && p.postedAt ? p.postedAt : p.scheduledAt;
  return (
    <li className="card animate-rise flex gap-3.5 !p-3">
      <div className="relative aspect-[2/3] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-card-2 ring-1 ring-border/60">
        <Image src={p.imageUrl} alt="" fill sizes="72px" className="object-cover" unoptimized />
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[15px] font-semibold">{formatLocal(when, tz, p.status === "posted" ? "MMM d · h:mm a" : "h:mm a")}</span>
          <span className={`badge ${st.cls}`}>{st.label}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-snug">{p.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{p.boardName || (p.boardId ? `Board ${p.boardId}` : "No board yet")}</p>
        {p.error && <p className="mt-1.5 line-clamp-3 rounded-xl bg-danger-soft px-2.5 py-1.5 text-xs text-danger-ink">{p.error}</p>}
        {p.status === "draft" && (
          <p className="mt-1.5 text-xs text-info-ink">Holds this slot. <Link href={`/pins/${p.id}/edit`} className="font-semibold underline">Pick a board</Link> to schedule it.</p>
        )}
        {draftLate && <p className="mt-1 text-xs text-muted">This time has passed; choose a new one when you add the board.</p>}
        {overdue && !p.error && <p className="mt-1 text-xs text-warn-ink">Running late. Check the posting job in Settings.</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-2 text-xs font-semibold">
          {p.status === "posted" && p.externalUrl && (
            <a href={p.externalUrl} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-accent-ink hover:bg-accent-soft" target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> View pin</a>
          )}
          {p.status !== "posted" && (
            <Link href={`/pins/${p.id}/edit`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-foreground/80 hover:bg-card-2"><Pencil size={13} /> Edit</Link>
          )}
          {p.status === "failed" && (
            <form action={retryPin}><input type="hidden" name="id" value={p.id} /><button className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-accent-ink hover:bg-accent-soft"><RotateCcw size={13} /> Retry</button></form>
          )}
          {p.status === "scheduled" && (
            <form action={postPinNow}><input type="hidden" name="id" value={p.id} /><button className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-foreground/80 hover:bg-card-2"><Send size={13} /> Post now</button></form>
          )}
          <form action={deletePin} className="ml-auto"><input type="hidden" name="id" value={p.id} /><button className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-muted hover:bg-danger-soft hover:text-danger-ink" aria-label="Delete pin"><Trash2 size={13} /></button></form>
        </div>
      </div>
    </li>
  );
}

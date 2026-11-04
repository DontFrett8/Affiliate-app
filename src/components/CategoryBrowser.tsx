"use client";

import { useState, useTransition } from "react";
import { assignAmazonCategory, browseInto, browseTopLevel, type BrowseResult } from "@/actions/browse";

type Ref = { id: string; name: string; url: string };

export function CategoryBrowser({ categories, canopyConfigured }: { categories: { id: number; name: string }[]; canopyConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<Ref[]>([]);
  const [current, setCurrent] = useState<Ref | null>(null);
  const [children, setChildren] = useState<Ref[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<number>(categories[0]?.id ?? 0);
  const [pending, start] = useTransition();
  const [requests, setRequests] = useState(0);

  function apply(r: BrowseResult, pushed?: Ref) {
    setRequests((n) => n + 1);
    if (!r.ok) return setError(r.error);
    setError(null);
    if (pushed) setTrail((t) => [...t, pushed]);
    setCurrent(r.current ?? pushed ?? null);
    setChildren(r.children);
  }

  function top() {
    start(async () => {
      setTrail([]);
      apply(await browseTopLevel());
    });
  }
  function into(ref: Ref) {
    const value = ref.url || ref.id;
    start(async () => apply(await browseInto(value), ref));
  }
  function back() {
    const t = trail.slice(0, -1);
    setTrail(t);
    const prev = t[t.length - 1];
    if (!prev) return top();
    start(async () => apply(await browseInto(prev.url || prev.id)));
  }
  function use(ref: Ref | null) {
    if (!ref || !targetId) return;
    start(async () => {
      await assignAmazonCategory(targetId, ref.url || ref.id, ref.name);
      setError(`Assigned “${ref.name}” to ${categories.find((c) => c.id === targetId)?.name}.`);
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full" disabled={!canopyConfigured} onClick={() => { setOpen(true); top(); }}>
        Browse Amazon best-seller categories (1 Canopy request per level)
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <strong className="section-title !text-base">Amazon category browser</strong>
        <span className="text-xs text-muted">{requests} request{requests === 1 ? "" : "s"} used</span>
      </div>
      <label className="label">Assign picks to</label>
      <select className="input" value={targetId} onChange={(e) => setTargetId(Number(e.target.value))}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
        <button type="button" className="underline" onClick={top} disabled={pending}>All departments</button>
        {trail.map((t, i) => <span key={t.id + i}> › {t.name}</span>)}
      </div>

      {current && (
        <div className="flex items-center justify-between rounded-2xl bg-card-2 p-3 text-sm">
          <span>Current: <strong>{current.name}</strong></span>
          <button type="button" className="btn-primary !py-1 !text-xs" disabled={pending} onClick={() => use(current)}>Use this</button>
        </div>
      )}

      {error && <p className="text-xs">{error}</p>}
      {pending && <p className="text-xs text-muted">Loading…</p>}

      <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-2xl border border-border text-sm">
        {children.map((c) => (
          <li key={c.id + c.url} className="flex items-center justify-between gap-2 px-3 py-2">
            <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => into(c)} disabled={pending}>{c.name} ›</button>
            <button type="button" className="text-xs underline" onClick={() => use(c)} disabled={pending}>use</button>
          </li>
        ))}
        {!pending && children.length === 0 && <li className="px-3 py-2 text-xs text-muted">No sub-categories here.</li>}
      </ul>
      <div className="flex gap-2">
        {trail.length > 0 && <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={back} disabled={pending}>← Back</button>}
        <button type="button" className="btn-ghost !py-1.5 !text-xs" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}

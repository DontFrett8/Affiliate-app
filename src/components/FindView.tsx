"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addManualProducts, refreshAllCategories, refreshCategory, removeProduct } from "@/actions/products";
import { affiliateLink } from "@/lib/amazon";
import { ProductCard, type ProductView } from "@/components/ProductCard";
import { SelectionBar } from "@/components/SelectionBar";
import { PageHeader } from "@/components/PageHeader";
import { SearchPanel } from "@/components/SearchPanel";
import { CheckCircle2, Clock3, Link as LinkIcon, RefreshCw, ShoppingBag, Sparkles } from "lucide-react";

type CategoryView = {
  id: number;
  name: string;
  amazonCategory: string;
  amazonCategoryName: string | null;
  lastRefreshedAt: string | null;
  lastError: string | null;
};

const SELECTION_KEY = "pinflow:selected";

export function FindView(props: {
  categories: CategoryView[];
  products: ProductView[];
  associateTag: string;
  timezone: string;
  canopyThisMonth: number;
  canopyLimit: number;
  canopyConfigured: boolean;
}) {
  const [mode, setMode] = useState<"best" | "search">("best");
  const router = useRouter();
  const [activeId, setActiveId] = useState<number | null>(props.categories[0]?.id ?? null);
  const [selected, setSelected] = useState<Record<string, ProductView>>({});
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | "all" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [lookup, setLookup] = useState(true);

  // Selection survives reloads on the phone.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTION_KEY);
      // Hydrating client-only state from localStorage after mount is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSelected(JSON.parse(raw));
      const lastCat = localStorage.getItem("pinflow:activeCategory");
      if (lastCat && props.categories.some((c) => c.id === Number(lastCat))) setActiveId(Number(lastCat));
    } catch {}
  }, [props.categories]);
  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selected));
    } catch {}
  }, [selected]);
  useEffect(() => {
    if (activeId != null) try { localStorage.setItem("pinflow:activeCategory", String(activeId)); } catch {}
  }, [activeId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const active = props.categories.find((c) => c.id === activeId) ?? null;
  const list = useMemo(() => props.products.filter((p) => p.categoryId === activeId), [props.products, activeId]);
  const selectedList = Object.values(selected);

  function toggle(p: ProductView) {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[p.asin]) delete next[p.asin];
      else next[p.asin] = p;
      return next;
    });
  }

  function refresh(id: number | "all") {
    setBusyId(id);
    startTransition(async () => {
      if (id === "all") {
        const res = await refreshAllCategories();
        const ok = res.filter((r) => r.ok).length;
        const bad = res.filter((r) => !r.ok);
        setToast(`Refreshed ${ok}/${res.length} categories${bad.length ? ` · failed: ${bad.map((b) => b.name).join(", ")}` : ""}`);
      } else {
        const r = await refreshCategory(id);
        setToast(r.ok ? `Kept ${r.count} varied picks from ${r.scanned} best sellers` : r.error);
      }
      setBusyId(null);
      router.refresh();
    });
  }

  function submitPaste() {
    if (!activeId || !pasteText.trim()) return;
    startTransition(async () => {
      const r = await addManualProducts(activeId, pasteText, lookup);
      setToast(r.ok ? `Added ${r.added}${r.skipped ? `, ${r.skipped} already there` : ""}` : r.error);
      if (r.ok) {
        setPasteText("");
        setPasteOpen(false);
      }
      router.refresh();
    });
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-US", { timeZone: props.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";

  const greeting = (() => {
    const h = Number(new Date().toLocaleString("en-US", { timeZone: props.timezone, hour: "numeric", hour12: false }));
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={greeting}
        title={<>What&apos;s <span className="italic text-accent">trending</span> today</>}
        subtitle={<span className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-accent-2" /> {props.canopyThisMonth} of {props.canopyLimit} lookups used this month</span>}
      />

      <div role="tablist" aria-label="Find products" className="grid grid-cols-2 gap-1 rounded-full bg-card-2 p-1 ring-1 ring-border/60">
        {([["best", "Best sellers"], ["search", "Search Amazon"]] as const).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-full py-2.5 text-sm font-semibold transition ${mode === value ? "bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_6px_16px_-8px_rgb(230_0_35/0.6)]" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <SearchPanel
          associateTag={props.associateTag}
          isSelected={(asin) => !!selected[asin]}
          onToggle={toggle}
          onToast={setToast}
          lookupsLeft={Math.max(0, props.canopyLimit - props.canopyThisMonth)}
        />
      ) : (
      <>

      <button
        className="btn-primary w-full !py-3.5 text-[15px]"
        disabled={pending || !props.canopyConfigured}
        onClick={() => refresh("all")}
        title={props.canopyConfigured ? "" : "Set CANOPY_API_KEY first"}
      >
        <RefreshCw size={17} className={busyId === "all" ? "animate-spin" : ""} />
        {busyId === "all" ? "Gathering best sellers…" : `Get top sellers · all ${props.categories.length} categories`}
      </button>

      {!props.canopyConfigured && (
        <p className="notice notice-warn">CANOPY_API_KEY isn&apos;t set yet, so refreshing is off. You can still paste Amazon links below.</p>
      )}

      {props.categories.length === 0 ? (
        <p className="card text-sm">
          No categories yet. <Link className="underline" href="/settings">Add some in Settings</Link>.
        </p>
      ) : (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
          {props.categories.map((c) => {
            const n = props.products.filter((p) => p.categoryId === c.id && selected[p.asin]).length;
            const on = c.id === activeId;
            return (
              <button key={c.id} onClick={() => setActiveId(c.id)} className={`chip ${on ? "chip-on" : "chip-off"}`}>
                {c.name}
                {n > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${on ? "bg-white text-accent" : "bg-accent-soft text-accent-ink"}`}>{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <section className="space-y-4">
          <div className="card-tinted flex flex-wrap items-center justify-between gap-3 !py-3.5">
            <div className="min-w-0 text-xs leading-relaxed text-muted">
              <p className="font-display text-base font-semibold text-foreground">{active.name}</p>
              <p className="inline-flex items-center gap-1"><Clock3 size={12} /> Updated {fmt(active.lastRefreshedAt)}{active.amazonCategoryName && <> · {active.amazonCategoryName}</>}</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !px-3.5 !py-2 !text-xs" disabled={pending || !props.canopyConfigured || !active.amazonCategory} onClick={() => refresh(active.id)}>
                <RefreshCw size={13} className={busyId === active.id ? "animate-spin" : ""} /> Refresh
              </button>
              <button className={`!px-3.5 !py-2 !text-xs ${pasteOpen ? "btn-soft" : "btn-secondary"}`} onClick={() => setPasteOpen((v) => !v)}>
                <LinkIcon size={13} /> Paste links
              </button>
            </div>
          </div>

          {active.lastError && <p className="notice notice-err text-xs">Last error: {active.lastError}</p>}
          {!active.amazonCategory && (
            <p className="notice notice-warn text-xs">
              This category has no Amazon best-sellers page yet. <Link className="font-semibold underline" href="/settings">Set it in Settings</Link>.
            </p>
          )}

          {pasteOpen && (
            <div className="card animate-rise space-y-3">
              <label className="label">Paste Amazon links or ASINs, one per line</label>
              <textarea className="input min-h-28 font-mono !text-sm" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="https://www.amazon.com/dp/B0ABC12345&#10;B0XYZ67890" />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={lookup} onChange={(e) => setLookup(e.target.checked)} disabled={!props.canopyConfigured} />
                Fetch name, photo and price (1 lookup per new link)
              </label>
              <div className="flex gap-2">
                <button className="btn-primary" disabled={pending || !pasteText.trim()} onClick={submitPaste}>Add to {active.name}</button>
                <button className="btn-ghost" onClick={() => setPasteOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {list.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-ink"><ShoppingBag size={24} /></span>
              <p className="font-display text-lg font-semibold">Nothing here yet</p>
              <p className="max-w-xs text-sm text-muted">Tap <strong>Refresh</strong> to pull today&apos;s {active.name.toLowerCase()} best sellers, or paste your own links.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3.5">
              {list.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  checked={!!selected[p.asin]}
                  onToggle={() => toggle(p)}
                  link={affiliateLink(p.asin, props.associateTag)}
                  onRemove={p.source === "manual" ? () => startTransition(async () => { await removeProduct(p.id); router.refresh(); }) : undefined}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      </>
      )}

      <SelectionBar
        items={selectedList}
        associateTag={props.associateTag}
        onClear={() => setSelected({})}
        onToast={setToast}
      />

      {toast && (
        <div role="status" className="animate-rise fixed inset-x-4 top-[max(env(safe-area-inset-top),1rem)] z-50 mx-auto flex max-w-md items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-rose">
          <CheckCircle2 size={16} className="shrink-0 text-accent-2" /> {toast}
        </div>
      )}
    </div>
  );
}

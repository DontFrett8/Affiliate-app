"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addManualProducts, refreshAllCategories, refreshCategory, removeProduct } from "@/actions/products";
import { affiliateLink } from "@/lib/amazon";
import { ProductCard, type ProductView } from "@/components/ProductCard";
import { SelectionBar } from "@/components/SelectionBar";

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
  canopyConfigured: boolean;
}) {
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
        setToast(r.ok ? `Got ${r.count} best sellers` : r.error);
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

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Find</h1>
          <p className="text-xs text-muted">Canopy requests this month: {props.canopyThisMonth} / 100 free</p>
        </div>
        <button className="btn-primary whitespace-nowrap" disabled={pending || !props.canopyConfigured} onClick={() => refresh("all")} title={props.canopyConfigured ? "" : "Set CANOPY_API_KEY first"}>
          {busyId === "all" ? "Refreshing…" : "Get top sellers"}
        </button>
      </header>

      {!props.canopyConfigured && (
        <p className="card border-amber-300 bg-amber-50 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          CANOPY_API_KEY isn&apos;t set yet, so refreshing is disabled. You can still paste Amazon links manually below.
        </p>
      )}

      {props.categories.length === 0 ? (
        <p className="card text-sm">
          No categories yet. <Link className="underline" href="/settings">Add some in Settings</Link>.
        </p>
      ) : (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {props.categories.map((c) => {
            const n = props.products.filter((p) => p.categoryId === c.id && selected[p.asin]).length;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${c.id === activeId ? "border-accent bg-accent text-white" : "border-border bg-card"}`}
              >
                {c.name}
                {n > 0 && <span className="ml-1 rounded-full bg-white/90 px-1.5 text-[10px] text-accent">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              Last refreshed: <strong className="text-foreground">{fmt(active.lastRefreshedAt)}</strong>
              {active.amazonCategoryName && <> · Amazon: {active.amazonCategoryName}</>}
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary !py-1.5 !text-xs" disabled={pending || !props.canopyConfigured || !active.amazonCategory} onClick={() => refresh(active.id)}>
                {busyId === active.id ? "Refreshing…" : "Refresh this"}
              </button>
              <button className="btn-secondary !py-1.5 !text-xs" onClick={() => setPasteOpen((v) => !v)}>
                Paste links
              </button>
            </div>
          </div>

          {active.lastError && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">Last error: {active.lastError}</p>}
          {!active.amazonCategory && (
            <p className="text-xs text-amber-700">
              This category has no Amazon best-sellers page set. <Link className="underline" href="/settings">Fix in Settings</Link>.
            </p>
          )}

          {pasteOpen && (
            <div className="card space-y-2">
              <label className="label">Paste Amazon links or ASINs (one per line)</label>
              <textarea className="input min-h-28 font-mono text-sm" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="https://www.amazon.com/dp/B0ABC12345&#10;B0XYZ67890" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={lookup} onChange={(e) => setLookup(e.target.checked)} disabled={!props.canopyConfigured} />
                Look up title/image/price (1 Canopy request per new link)
              </label>
              <div className="flex gap-2">
                <button className="btn-primary" disabled={pending || !pasteText.trim()} onClick={submitPaste}>Add to {active.name}</button>
                <button className="btn-ghost" onClick={() => setPasteOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {list.length === 0 ? (
            <div className="card text-center text-sm text-muted">
              Nothing cached for {active.name} yet. Tap <strong>Refresh this</strong> (1 request) or paste links.
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
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

      <SelectionBar
        items={selectedList}
        associateTag={props.associateTag}
        onClear={() => setSelected({})}
        onToast={setToast}
      />

      {toast && (
        <div className="fixed inset-x-4 bottom-36 z-50 mx-auto max-w-md rounded-xl bg-foreground px-4 py-3 text-center text-sm text-background shadow-lg">{toast}</div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search as SearchIcon, ShoppingBag } from "lucide-react";
import { searchAmazon, type SearchSort } from "@/actions/search";
import type { SearchItem } from "@/db/schema";
import { affiliateLink } from "@/lib/amazon";
import { ProductCard, type ProductView } from "@/components/ProductCard";

const SORTS: { value: SearchSort; label: string }[] = [
  { value: "FEATURED", label: "Most relevant" },
  { value: "AVERAGE_CUSTOMER_REVIEW", label: "Best rated" },
  { value: "PRICE_ASCENDING", label: "Price: low to high" },
  { value: "PRICE_DESCENDING", label: "Price: high to low" },
  { value: "MOST_RECENT", label: "Newest" },
];

const LAST_KEY = "pinflow:lastSearch";

export function toView(it: SearchItem): ProductView {
  return {
    id: 0,
    categoryId: 0,
    asin: it.asin,
    title: it.title,
    imageUrl: it.imageUrl,
    priceDisplay: it.priceDisplay,
    priceValue: null,
    rating: it.rating,
    ratingsTotal: it.ratingsTotal,
    rank: null,
    source: "search",
    fetchedAt: "",
    sponsored: it.sponsored,
  };
}

export function SearchPanel(props: {
  associateTag: string;
  isSelected: (asin: string) => boolean;
  onToggle: (p: ProductView) => void;
  onToast: (m: string) => void;
  lookupsLeft: number;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SearchSort>("FEATURED");
  const [maxPrice, setMaxPrice] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Restore the last search's settings (results come from the free cache).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      if (!raw) return;
      const last = JSON.parse(raw) as { query: string; sort: SearchSort; maxPrice: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client-only state
      setQuery(last.query);
      setSort(last.sort);
      setMaxPrice(last.maxPrice);
    } catch {}
  }, []);

  function run(nextPage: number) {
    const q = query.trim();
    if (q.length < 2) return;
    start(async () => {
      const r = await searchAmazon({ query: q, page: nextPage, sort, maxPrice: maxPrice ? Number(maxPrice) : null });
      if (!r.ok) {
        setStatus(r.error);
        props.onToast(r.limitReached ? "Monthly lookup limit reached" : "Search failed");
        return;
      }
      setItems((cur) => {
        if (nextPage === 1) return r.items;
        const have = new Set(cur.map((c) => c.asin));
        return [...cur, ...r.items.filter((i) => !have.has(i.asin))];
      });
      setPage(nextPage);
      setTotalPages(r.totalPages);
      setLastQuery(q);
      setStatus(r.cached ? "Saved search: no lookup used." : "Used 1 lookup.");
      try { localStorage.setItem(LAST_KEY, JSON.stringify({ query: q, sort, maxPrice })); } catch {}
    });
  }

  const hasMore = totalPages == null ? items.length >= 16 : page < totalPages;

  return (
    <section className="space-y-4">
      <form
        className="card space-y-3 !p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(1);
        }}
      >
        <div className="relative">
          <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input !pl-11"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search Amazon, e.g. velvet throw pillow"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search Amazon"
          />
        </div>
        <div className="flex gap-2">
          <select className="input !py-2.5 !text-sm" value={sort} onChange={(e) => setSort(e.target.value as SearchSort)} aria-label="Sort">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input
            className="input !w-28 !py-2.5 !text-sm"
            inputMode="numeric"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ""))}
            aria-label="Maximum price"
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={pending || query.trim().length < 2}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <SearchIcon size={16} />}
          {pending ? "Searching…" : "Search"}
        </button>
        <p className="text-center text-[11px] text-muted">
          Each new search uses 1 lookup ({props.lookupsLeft} left this month). Repeating a search within a week is free.
        </p>
      </form>

      {status && <p className={`text-center text-xs ${/limit|failed|error/i.test(status) ? "notice notice-warn" : "text-muted"}`}>{status}</p>}

      {items.length === 0 && !pending && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-ink"><ShoppingBag size={24} /></span>
          <p className="font-display text-lg font-semibold">Find anything on Amazon</p>
          <p className="max-w-xs text-sm text-muted">Search for the pieces your board still needs. Tick them and copy the links just like best sellers.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <p className="px-1 text-xs text-muted">Results for <strong className="text-foreground">“{lastQuery}”</strong></p>
          <ul className="grid grid-cols-2 gap-3.5">
            {items.map((it) => {
              const v = toView(it);
              return (
                <ProductCard
                  key={it.asin}
                  product={v}
                  checked={props.isSelected(it.asin)}
                  onToggle={() => props.onToggle(v)}
                  link={affiliateLink(it.asin, props.associateTag)}
                />
              );
            })}
          </ul>
          {hasMore && (
            <button className="btn-secondary w-full" disabled={pending} onClick={() => run(page + 1)}>
              {pending ? "Loading…" : "Load more (1 lookup)"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

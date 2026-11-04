"use client";

import Image from "next/image";

export type ProductView = {
  id: number;
  categoryId: number;
  asin: string;
  title: string;
  imageUrl: string | null;
  priceDisplay: string | null;
  priceValue: number | null;
  rating: number | null;
  ratingsTotal: number | null;
  rank: number | null;
  source: string;
  fetchedAt: string;
};

export function ProductCard({ product: p, checked, onToggle, link, onRemove }: { product: ProductView; checked: boolean; onToggle: () => void; link: string; onRemove?: () => void }) {
  return (
    <li className={`card relative flex flex-col gap-2 !p-3 ${checked ? "ring-2 ring-accent" : ""}`}>
      <label className="absolute left-2 top-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-white/90 shadow dark:bg-black/60">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={checked} onChange={onToggle} aria-label={`Select ${p.title}`} />
      </label>
      {p.rank != null && p.source === "canopy" && <span className="absolute right-2 top-2 z-10 badge bg-foreground text-background">#{p.rank}</span>}
      <button type="button" onClick={onToggle} className="relative aspect-square w-full overflow-hidden rounded-xl bg-white">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, 300px" className="object-contain p-2" unoptimized />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted">no image</div>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs leading-snug" title={p.title}>{p.title}</p>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="font-semibold">{p.priceDisplay ?? ""}</span>
          {p.rating != null && (
            <span className="text-muted">★ {p.rating.toFixed(1)}{p.ratingsTotal ? ` (${Intl.NumberFormat("en", { notation: "compact" }).format(p.ratingsTotal)})` : ""}</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <a href={link} target="_blank" rel="noopener noreferrer" className="underline text-muted">amazon.com ↗</a>
        {onRemove && <button type="button" onClick={onRemove} className="text-muted">remove</button>}
      </div>
    </li>
  );
}

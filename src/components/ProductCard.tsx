"use client";

import Image from "next/image";
import { Check, ExternalLink, Star, X } from "lucide-react";

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
  productType?: string | null;
  sponsored?: boolean;
};

export function ProductCard({ product: p, checked, onToggle, link, onRemove }: { product: ProductView; checked: boolean; onToggle: () => void; link: string; onRemove?: () => void }) {
  return (
    <li
      className={`group relative flex flex-col overflow-hidden rounded-[1.5rem] border bg-card shadow-rose transition duration-200 ${
        checked ? "border-transparent ring-2 ring-accent ring-offset-2 ring-offset-background" : "border-border/70"
      }`}
    >
      <button type="button" onClick={onToggle} aria-pressed={checked} aria-label={`${checked ? "Unselect" : "Select"} ${p.title}`} className="relative aspect-square w-full bg-white">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, 280px" className="object-contain p-3 transition duration-300 group-hover:scale-[1.03]" unoptimized />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center text-xs text-muted">{p.asin}</div>
        )}
        {p.rank != null && p.source === "canopy" && (
          <span className="badge absolute left-2.5 top-2.5 bg-foreground/85 text-background backdrop-blur">#{p.rank}</span>
        )}
        <span
          className={`absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border shadow-sm transition ${
            checked ? "border-transparent bg-gradient-to-br from-accent to-accent-2 text-white" : "border-black/10 bg-white/90 text-transparent shadow-sm backdrop-blur"
          }`}
        >
          <Check size={16} strokeWidth={3} />
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {(p.productType || p.sponsored) && (
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-ink">
            {p.sponsored ? "Sponsored" : p.productType}
          </p>
        )}
        <p className="line-clamp-2 text-[13px] leading-snug text-foreground/90" title={p.title}>{p.title}</p>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs">
          <span className="font-display text-[15px] font-semibold">{p.priceDisplay ?? ""}</span>
          {p.rating != null && (
            <span className="inline-flex items-center gap-0.5 text-muted">
              <Star size={12} className="fill-current text-accent-2" />
              {p.rating.toFixed(1)}
              {p.ratingsTotal ? <span className="opacity-70">({Intl.NumberFormat("en", { notation: "compact" }).format(p.ratingsTotal)})</span> : null}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent-ink">
            View on Amazon <ExternalLink size={11} />
          </a>
          {onRemove && (
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-0.5 hover:text-danger-ink" aria-label="Remove">
              <X size={12} /> Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

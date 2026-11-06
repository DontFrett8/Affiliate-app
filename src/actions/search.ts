"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { searchCache, type SearchItem } from "@/db/schema";
import { LookupLimitError, searchProducts } from "@/lib/canopy";

const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
export type SearchSort = "FEATURED" | "AVERAGE_CUSTOMER_REVIEW" | "PRICE_ASCENDING" | "PRICE_DESCENDING" | "MOST_RECENT";

export type SearchResponse =
  | { ok: true; items: SearchItem[]; page: number; totalPages: number | null; cached: boolean }
  | { ok: false; error: string; limitReached?: boolean };

/** Search Amazon through Canopy. Identical searches within 7 days are served from the database for free. */
export async function searchAmazon(input: { query: string; page?: number; sort?: SearchSort; maxPrice?: number | null }): Promise<SearchResponse> {
  const query = input.query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (query.length < 2) return { ok: false, error: "Type at least 2 characters." };
  const page = Math.max(1, Math.min(Number(input.page) || 1, 20));
  const sort = input.sort ?? "FEATURED";
  const maxPrice = input.maxPrice && input.maxPrice > 0 ? Math.round(input.maxPrice) : null;
  const cacheKey = [query.toLowerCase(), page, sort, maxPrice ?? ""].join("|");

  const [hit] = await db.select().from(searchCache).where(eq(searchCache.cacheKey, cacheKey));
  if (hit && Date.now() - hit.fetchedAt.getTime() < CACHE_MS) {
    return { ok: true, items: hit.results, page, totalPages: hit.totalPages, cached: true };
  }

  try {
    const r = await searchProducts({ query, page, sort, maxPrice: maxPrice ?? undefined });
    const seen = new Set<string>();
    const items: SearchItem[] = [];
    for (const p of r.results) {
      if (!p.asin || seen.has(p.asin)) continue;
      seen.add(p.asin);
      items.push({
        asin: p.asin,
        title: p.title ?? "",
        imageUrl: p.mainImageUrl ?? null,
        priceDisplay: p.price?.display ?? null,
        rating: typeof p.rating === "number" ? p.rating : null,
        ratingsTotal: typeof p.ratingsTotal === "number" ? p.ratingsTotal : null,
        sponsored: !!p.sponsored,
      });
    }
    await db
      .insert(searchCache)
      .values({ cacheKey, results: items, totalPages: r.totalPages, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: searchCache.cacheKey, set: { results: items, totalPages: r.totalPages, fetchedAt: new Date() } });
    return { ok: true, items, page, totalPages: r.totalPages, cached: false };
  } catch (err) {
    if (err instanceof LookupLimitError) return { ok: false, error: err.message, limitReached: true };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

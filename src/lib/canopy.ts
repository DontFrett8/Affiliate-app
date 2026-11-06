import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { apiUsage, settings } from "@/db/schema";

const BASE = "https://rest.canopyapi.co";

export type CanopyProduct = {
  title: string;
  url: string;
  asin: string;
  price: { symbol: string; value: number; currency: string; display: string } | null;
  mainImageUrl: string;
  rating: number;
  ratingsTotal: number;
  bestSellersRank: number;
};

export type CanopyCategoryRef = { name: string; url: string; id: string };

export type BestSellersResult = {
  products: CanopyProduct[];
  currentCategory: CanopyCategoryRef | null;
  parentCategory: CanopyCategoryRef | null;
  childCategories: CanopyCategoryRef[];
};

function apiKey() {
  const k = process.env.CANOPY_API_KEY;
  if (!k) throw new Error("CANOPY_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
  return k;
}

async function logUsage(endpoint: string, ok: boolean) {
  try {
    await db.insert(apiUsage).values({ provider: "canopy", endpoint, ok });
  } catch {
    /* usage logging must never break the request */
  }
}

export class LookupLimitError extends Error {}

/** Canopy lookups used so far this calendar month (UTC). */
export async function canopyUsedThisMonth() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(apiUsage).where(and(eq(apiUsage.provider, "canopy"), gte(apiUsage.createdAt, monthStart)));
  return Number(n);
}

/** Refuse before calling Canopy when the owner's monthly cap is reached, so lookups never cost money unexpectedly. */
async function assertUnderLimit() {
  const [row] = await db.select({ limit: settings.canopyMonthlyLimit }).from(settings).where(eq(settings.id, 1));
  const limit = row?.limit ?? 100;
  const used = await canopyUsedThisMonth();
  if (used >= limit) {
    throw new LookupLimitError(
      `You've used all ${limit} Amazon lookups for this month. Saved results still work. To allow more (about $0.01 each past the free 100), raise the limit in Settings.`,
    );
  }
}

async function canopyGet(path: string, params: Record<string, string>) {
  await assertUnderLimit();
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "API-KEY": apiKey() }, cache: "no-store" });
  await logUsage(path, res.ok);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Canopy ${res.status}: ${body.slice(0, 300) || res.statusText}`);
  }
  return res.json();
}

/** Decide whether a stored category value is a slug or a URL. */
export function categoryParams(amazonCategory: string): Record<string, string> {
  const v = amazonCategory.trim();
  if (/^https?:\/\//i.test(v)) return { url: v };
  if (/^\d+$/.test(v)) return { url: `https://www.amazon.com/gp/bestsellers/-/${v}` }; // bare node id
  return { categoryId: v, domain: "US" };
}

/** One request → up to `limit` best sellers for a category (slug or URL). */
export async function fetchBestSellers(amazonCategory: string, limit = 50): Promise<BestSellersResult> {
  const json = await canopyGet("/api/amazon/bestsellers", { ...categoryParams(amazonCategory), limit: String(limit), page: "1" });
  const bs = json?.data?.amazonBestSellers;
  if (!bs) throw new Error("Canopy returned no bestseller data for this category");
  return {
    products: (bs.productResults?.results ?? []) as CanopyProduct[],
    currentCategory: bs.categoryInfo?.currentCategory ?? null,
    parentCategory: bs.categoryInfo?.parentCategory ?? null,
    childCategories: bs.categoryInfo?.childCategories ?? [],
  };
}

/** One request → Amazon's top-level best-seller categories (slugs usable as categoryId). */
export async function fetchTopLevelCategories(): Promise<CanopyCategoryRef[]> {
  const json = await canopyGet("/api/amazon/bestseller-categories", { domain: "US" });
  const list = json?.data?.amazonBestSellerCategories?.categories ?? [];
  return list.filter((c: Partial<CanopyCategoryRef>) => c?.id && c?.name) as CanopyCategoryRef[];
}

/** One request → product details for a pasted ASIN (title, image, price, rating). */
export async function fetchProduct(asin: string) {
  const json = await canopyGet("/api/amazon/product", { asin, domain: "US" });
  const p = json?.data?.amazonProduct ?? json?.data?.product ?? json?.data;
  if (!p) throw new Error("Canopy returned no product data");
  return {
    title: String(p.title ?? ""),
    imageUrl: (p.mainImageUrl as string | undefined) ?? p.images?.[0]?.hiRes ?? p.images?.[0]?.url ?? null,
    priceDisplay: (p.price?.display as string | undefined) ?? null,
    priceValue: typeof p.price?.value === "number" ? (p.price.value as number) : null,
    rating: typeof p.rating === "number" ? (p.rating as number) : null,
    ratingsTotal: typeof p.ratingsTotal === "number" ? (p.ratingsTotal as number) : null,
  };
}

export type CanopySearchResult = {
  title: string;
  asin: string;
  price: { display: string; value: number } | null;
  mainImageUrl: string;
  rating: number;
  ratingsTotal: number;
  sponsored?: boolean;
};

/** One request → one page of Amazon search results (typically 20–40 items). */
export async function searchProducts(opts: { query: string; page?: number; sort?: string; minPrice?: number; maxPrice?: number }) {
  const params: Record<string, string> = { searchTerm: opts.query, domain: "US", page: String(opts.page ?? 1) };
  if (opts.sort && opts.sort !== "FEATURED") params.sort = opts.sort;
  if (opts.minPrice != null) params.minPrice = String(opts.minPrice);
  if (opts.maxPrice != null) params.maxPrice = String(opts.maxPrice);
  const json = await canopyGet("/api/amazon/search", params);
  const r = json?.data?.amazonProductSearchResults;
  return {
    results: (r?.productResults?.results ?? []) as CanopySearchResult[],
    totalPages: (r?.productResults?.pageInfo?.totalPages as number | undefined) ?? null,
  };
}

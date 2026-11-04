import { db } from "@/db";
import { apiUsage } from "@/db/schema";

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

async function canopyGet(path: string, params: Record<string, string>) {
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
export async function fetchBestSellers(amazonCategory: string, limit = 15): Promise<BestSellersResult> {
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

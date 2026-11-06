"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { fetchBestSellers, fetchProduct } from "@/lib/canopy";
import { labelProducts, pickVariety } from "@/lib/sorter";
import { extractAsin, parsePastedLinks } from "@/lib/amazon";

const TOP_N = 15;

/** Fetch best sellers for one category (1 Canopy request) and replace the cached list. */
export async function refreshCategory(categoryId: number) {
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!cat) return { ok: false as const, error: "Category not found" };
  if (!cat.amazonCategory) return { ok: false as const, error: `"${cat.name}" has no Amazon category set. Add one in Settings.` };
  try {
    // One lookup returns up to 50 best sellers; keep the top 15 with variety.
    const res = await fetchBestSellers(cat.amazonCategory, 50);
    const unique = new Map(res.products.filter((p) => p.asin).map((p) => [p.asin, p]));
    const pool = [...unique.values()];
    const { labels, source: labelSource } = await labelProducts(pool.map((p) => p.title ?? ""), cat.name);
    const picked = pickVariety(pool, labels, cat.uniqueTypes, TOP_N);
    const now = new Date();
    await db.delete(products).where(and(eq(products.categoryId, categoryId), eq(products.source, "canopy")));
    if (picked.length) {
      await db
        .insert(products)
        .values(
          picked.map(({ item: p, label }, i) => ({
            categoryId,
            asin: p.asin,
            title: p.title ?? "",
            imageUrl: p.mainImageUrl ?? null,
            priceDisplay: p.price?.display ?? null,
            priceValue: p.price?.value ?? null,
            rating: p.rating ?? null,
            ratingsTotal: p.ratingsTotal ?? null,
            rank: p.bestSellersRank ?? i + 1,
            // Only show the type label when the AI wrote it; fallback labels are rough.
            productType: labelSource === "ai" ? label.type : null,
            source: "canopy",
            fetchedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [products.categoryId, products.asin],
          set: { source: "canopy", fetchedAt: now },
        });
    }
    await db
      .update(categories)
      .set({
        lastRefreshedAt: now,
        lastError: null,
        amazonCategoryName: res.currentCategory?.name ?? cat.amazonCategoryName,
        childCategories: res.childCategories,
      })
      .where(eq(categories.id, categoryId));
    revalidatePath("/");
    return { ok: true as const, count: picked.length, scanned: pool.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(categories).set({ lastError: message.slice(0, 500) }).where(eq(categories.id, categoryId));
    revalidatePath("/");
    return { ok: false as const, error: message };
  }
}

/** Refresh every category that has an Amazon target. One request per category. */
export async function refreshAllCategories() {
  const all = await db.select({ id: categories.id, name: categories.name, amazonCategory: categories.amazonCategory }).from(categories);
  const results: { name: string; ok: boolean; info: string }[] = [];
  for (const c of all) {
    if (!c.amazonCategory) {
      results.push({ name: c.name, ok: false, info: "no Amazon category set" });
      continue;
    }
    const r = await refreshCategory(c.id);
    results.push({ name: c.name, ok: r.ok, info: r.ok ? `${r.count} products` : r.error });
    if (!r.ok && /lookups for this month/.test(r.error)) break;
  }
  return results;
}

/** Paste Amazon links/ASINs into a category. Uses one Canopy request per new ASIN for title/image (optional). */
export async function addManualProducts(categoryId: number, text: string, lookup: boolean) {
  const asins = Array.from(new Set(parsePastedLinks(text).map(extractAsin).filter((a): a is string => !!a)));
  if (!asins.length) return { ok: false as const, error: "No ASINs found in that text." };
  const existing = await db
    .select({ asin: products.asin })
    .from(products)
    .where(and(eq(products.categoryId, categoryId), inArray(products.asin, asins)));
  const have = new Set(existing.map((e) => e.asin));
  const fresh = asins.filter((a) => !have.has(a));
  let looked = 0;
  for (const asin of fresh) {
    let details: Partial<typeof products.$inferInsert> = {};
    if (lookup) {
      try {
        const p = await fetchProduct(asin);
        details = { title: p.title, imageUrl: p.imageUrl, priceDisplay: p.priceDisplay, priceValue: p.priceValue, rating: p.rating, ratingsTotal: p.ratingsTotal };
        looked++;
      } catch {
        /* keep a bare entry */
      }
    }
    await db.insert(products).values({ categoryId, asin, title: details.title ?? asin, source: "manual", ...details }).onConflictDoNothing();
  }
  revalidatePath("/");
  return { ok: true as const, added: fresh.length, skipped: asins.length - fresh.length, looked };
}

export async function removeProduct(productId: number) {
  await db.delete(products).where(eq(products.id, productId));
  revalidatePath("/");
}

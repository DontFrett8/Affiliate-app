"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { fetchBestSellers, fetchTopLevelCategories, type CanopyCategoryRef } from "@/lib/canopy";

export type BrowseResult =
  | { ok: true; current: CanopyCategoryRef | null; parent: CanopyCategoryRef | null; children: CanopyCategoryRef[] }
  | { ok: false; error: string };

/** 1 Canopy request: Amazon's top-level best-seller departments. */
export async function browseTopLevel(): Promise<BrowseResult> {
  try {
    const list = await fetchTopLevelCategories();
    return { ok: true, current: null, parent: null, children: list };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 1 Canopy request: drill into a department/sub-category and list its children. */
export async function browseInto(amazonCategory: string): Promise<BrowseResult> {
  try {
    const r = await fetchBestSellers(amazonCategory, 1);
    return { ok: true, current: r.currentCategory, parent: r.parentCategory, children: r.childCategories };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Point one of your categories at a chosen Amazon best-sellers page. */
export async function assignAmazonCategory(categoryId: number, amazonCategory: string, amazonCategoryName: string | null) {
  await db
    .update(categories)
    .set({ amazonCategory, amazonCategoryName, childCategories: null, lastRefreshedAt: null, lastError: null })
    .where(eq(categories.id, categoryId));
  revalidatePath("/", "layout");
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, settings } from "@/db/schema";
import { DEFAULT_CATEGORIES } from "@/db/seed-data";

/** Returns the singleton settings row, creating it (and default categories) on first run. */
export async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;
  const [created] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  const existing = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing.length === 0) {
    await db.insert(categories).values(DEFAULT_CATEGORIES.map((c, i) => ({ name: c.name, amazonCategory: c.amazonCategory, sortOrder: i })));
  }
  if (created) return created;
  const [again] = await db.select().from(settings).where(eq(settings.id, 1));
  return again;
}

export function buildDefaultDescription(opts: { categoryName?: string | null; hashtags: string; disclosure: string }) {
  const parts: string[] = [];
  if (opts.categoryName) parts.push(`My favorite ${opts.categoryName.toLowerCase()} finds right now — tap to shop the full list.`);
  if (opts.hashtags.trim()) parts.push(opts.hashtags.trim());
  parts.push(opts.disclosure.trim());
  return parts.join("\n\n");
}

export function buildDefaultTitle(categoryName?: string | null) {
  return categoryName ? `${categoryName} Amazon Finds` : "Amazon Finds";
}

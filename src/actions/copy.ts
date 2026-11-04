"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { apiUsage, categories } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { suggestPinCopy, type CopySuggestion } from "@/lib/copywriter";

/** Suggest a pin title + description for the products checked on the Find tab. */
export async function suggestCopy(input: { titles: string[]; categoryIds: number[] }): Promise<CopySuggestion> {
  const titles = input.titles.map((t) => String(t).slice(0, 300)).filter(Boolean).slice(0, 20);
  const s = await getSettings();

  // Most common category among the selected products names the theme.
  let categoryName: string | null = null;
  const ids = input.categoryIds.filter((n) => Number.isInteger(n));
  if (ids.length) {
    const counts = new Map<number, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, [top]));
    categoryName = rows[0]?.name ?? null;
  }

  const result = await suggestPinCopy({
    products: titles.map((title) => ({ title })),
    categoryName,
    hashtags: s.defaultHashtags,
    disclosure: s.disclosureText,
  });
  if (result.source === "ai") {
    await db.insert(apiUsage).values({ provider: "ai", endpoint: `copy:${result.model ?? ""}:${result.usage?.input ?? 0}/${result.usage?.output ?? 0}`, ok: true }).catch(() => {});
  }
  return { title: result.title, description: result.description, source: result.source, note: result.note };
}

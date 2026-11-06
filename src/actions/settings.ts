"use server";

import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories, settings } from "@/db/schema";
import { normalizeTimes } from "@/lib/schedule";
import { DEFAULT_CATEGORIES } from "@/db/seed-data";

export async function saveSettings(formData: FormData) {
  const times = normalizeTimes(String(formData.get("dailyTimes") ?? "").split(/[\n,]+/));
  const disclosure = String(formData.get("disclosureText") ?? "").trim();
  await db
    .update(settings)
    .set({
      associateTag: String(formData.get("associateTag") ?? "").trim(),
      defaultDestinationLink: String(formData.get("defaultDestinationLink") ?? "").trim(),
      dailyTimes: times.length ? times : ["09:00", "12:30", "17:00", "20:30"],
      timezone: String(formData.get("timezone") ?? "America/Chicago").trim() || "America/Chicago",
      defaultHashtags: String(formData.get("defaultHashtags") ?? "").trim(),
      disclosureText: disclosure || "#ad As an Amazon Associate I earn from qualifying purchases.",
      defaultBoardId: String(formData.get("defaultBoardId") ?? "").trim() || null,
      canopyMonthlyLimit: Math.max(0, Math.min(5000, Math.round(Number(formData.get("canopyMonthlyLimit")) || 100))),
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));
  revalidatePath("/", "layout");
}

export async function addCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const [{ max }] = await db.select({ max: categories.sortOrder }).from(categories).orderBy(desc(categories.sortOrder)).limit(1);
  await db.insert(categories).values({
    name,
    amazonCategory: String(formData.get("amazonCategory") ?? "").trim(),
    uniqueTypes: formData.get("uniqueTypes") !== "off",
    sortOrder: (max ?? 0) + 1,
  });
  revalidatePath("/", "layout");
}

export async function updateCategory(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const amazonCategory = String(formData.get("amazonCategory") ?? "").trim();
  if (!id || !name) return;
  const [cur] = await db.select().from(categories).where(eq(categories.id, id));
  const changed = cur && cur.amazonCategory !== amazonCategory;
  await db
    .update(categories)
    .set({
      name,
      amazonCategory,
      ...(formData.has("uniqueTypesShown") ? { uniqueTypes: formData.get("uniqueTypes") === "on" } : {}),
      // Reset cached category info if the Amazon target changed.
      ...(changed ? { amazonCategoryName: null, childCategories: null, lastRefreshedAt: null, lastError: null } : {}),
    })
    .where(eq(categories.id, id));
  revalidatePath("/", "layout");
}

export async function deleteCategory(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/", "layout");
}

export async function moveCategory(formData: FormData) {
  const id = Number(formData.get("id"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  const all = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  const i = all.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await Promise.all(all.map((c, idx) => db.update(categories).set({ sortOrder: idx }).where(eq(categories.id, c.id))));
  revalidatePath("/", "layout");
}

export async function restoreDefaultCategories() {
  const existing = await db.select({ name: categories.name }).from(categories);
  const have = new Set(existing.map((c) => c.name.toLowerCase()));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(c.name.toLowerCase()));
  if (missing.length) {
    await db.insert(categories).values(missing.map((c, i) => ({ name: c.name, amazonCategory: c.amazonCategory, sortOrder: existing.length + i })));
  }
  revalidatePath("/", "layout");
}

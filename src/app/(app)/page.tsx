import { asc, and, gte, eq, count } from "drizzle-orm";
import { db } from "@/db";
import { apiUsage, categories, products } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { FindView } from "@/components/FindView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find" };

export default async function FindPage() {
  const s = await getSettings();
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  const prods = await db.select().from(products).orderBy(asc(products.rank), asc(products.id));
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ n: canopyThisMonth }] = await db
    .select({ n: count() })
    .from(apiUsage)
    .where(and(eq(apiUsage.provider, "canopy"), gte(apiUsage.createdAt, monthStart)));

  return (
    <FindView
      categories={cats.map((c) => ({ ...c, lastRefreshedAt: c.lastRefreshedAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString() }))}
      products={prods.map((p) => ({ ...p, fetchedAt: p.fetchedAt.toISOString() }))}
      associateTag={s.associateTag}
      timezone={s.timezone}
      canopyThisMonth={Number(canopyThisMonth)}
      canopyLimit={s.canopyMonthlyLimit}
      canopyConfigured={!!process.env.CANOPY_API_KEY}
    />
  );
}

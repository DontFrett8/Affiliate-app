import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { pins } from "@/db/schema";
import { getPublisher } from "@/lib/platforms";

const MAX_ATTEMPTS = 3;

/** Publish one pin now (used by the cron job and the manual "Post now"/"Retry" buttons). */
export async function publishPin(pinId: number) {
  // Atomically claim the pin so two overlapping cron runs can't double-post.
  const [pin] = await db
    .update(pins)
    .set({ status: "posting", updatedAt: new Date(), attempts: sql`${pins.attempts} + 1` })
    .where(and(eq(pins.id, pinId), sql`${pins.status} in ('scheduled','failed')`))
    .returning();
  if (!pin) return { id: pinId, skipped: true as const };

  try {
    const result = await getPublisher(pin.platform).publish(pin);
    await db
      .update(pins)
      .set({ status: "posted", postedAt: new Date(), externalId: result.externalId, externalUrl: result.externalUrl ?? null, error: null, updatedAt: new Date() })
      .where(eq(pins.id, pin.id));
    return { id: pin.id, ok: true as const, externalId: result.externalId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(pins).set({ status: "failed", error: message.slice(0, 1000), updatedAt: new Date() }).where(eq(pins.id, pin.id));
    return { id: pin.id, ok: false as const, error: message };
  }
}

/** Publish everything whose time has come. Failed pins get retried automatically up to MAX_ATTEMPTS. */
export async function publishDuePins(now = new Date()) {
  const due = await db
    .select({ id: pins.id })
    .from(pins)
    .where(
      and(
        lte(pins.scheduledAt, now),
        sql`(${pins.status} = 'scheduled' or (${pins.status} = 'failed' and ${pins.attempts} < ${MAX_ATTEMPTS}))`,
      ),
    )
    .orderBy(pins.scheduledAt)
    .limit(10);

  const results = [];
  for (const { id } of due) results.push(await publishPin(id));
  return results;
}

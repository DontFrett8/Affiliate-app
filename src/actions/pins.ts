"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { pins } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { fromLocalInputValue, nextOpenSlot } from "@/lib/schedule";
import { publishPin } from "@/lib/publish";
import { getPublisher } from "@/lib/platforms";

import { DESC_MAX, TITLE_MAX } from "@/lib/limits";

export type PinFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

async function takenSlots() {
  const rows = await db
    .select({ scheduledAt: pins.scheduledAt })
    .from(pins)
    .where(inArray(pins.status, ["draft", "scheduled", "posting", "posted"]));
  return rows.map((r) => r.scheduledAt);
}

export async function suggestSlot() {
  const s = await getSettings();
  return nextOpenSlot(new Date(), s.dailyTimes, s.timezone, await takenSlots());
}

function validate(data: FormData, disclosure: string) {
  const fieldErrors: Record<string, string> = {};
  const imageUrl = String(data.get("imageUrl") ?? "").trim();
  const destinationLink = String(data.get("destinationLink") ?? "").trim();
  const boardId = String(data.get("boardId") ?? "").trim();
  const boardName = String(data.get("boardName") ?? "").trim() || null;
  const title = String(data.get("title") ?? "").trim();
  const description = String(data.get("description") ?? "").trim();
  const altText = String(data.get("altText") ?? "").trim() || null;
  const scheduledLocal = String(data.get("scheduledAt") ?? "").trim();
  const categoryId = Number(data.get("categoryId")) || null;

  if (!imageUrl) fieldErrors.imageUrl = "Upload an image first.";
  if (!/^https?:\/\//i.test(destinationLink)) fieldErrors.destinationLink = "Enter a full link starting with https://";
  if (!title) fieldErrors.title = "Title is required.";
  if (title.length > TITLE_MAX) fieldErrors.title = `Title must be ≤ ${TITLE_MAX} characters.`;
  if (!description) fieldErrors.description = "Description is required.";
  if (description.length > DESC_MAX) fieldErrors.description = `Description must be ≤ ${DESC_MAX} characters.`;
  const disc = disclosure.trim();
  if (disc && !description.toLowerCase().includes(disc.toLowerCase())) {
    fieldErrors.description = `Description must include your disclosure: "${disc}"`;
  }
  if (!scheduledLocal) fieldErrors.scheduledAt = "Pick a time.";
  return { fieldErrors, values: { imageUrl, destinationLink, boardId, boardName, title, description, altText, scheduledLocal, categoryId } };
}

export async function createPin(_prev: PinFormState, data: FormData): Promise<PinFormState> {
  const s = await getSettings();
  const { fieldErrors, values } = validate(data, s.disclosureText);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const scheduledAt = fromLocalInputValue(values.scheduledLocal, s.timezone);
  const postNow = data.get("intent") === "now";
  if (postNow && !values.boardId) return { fieldErrors: { boardId: "Pick a board to post now." } };
  const [row] = await db
    .insert(pins)
    .values({
      imageUrl: values.imageUrl,
      destinationLink: values.destinationLink,
      boardId: values.boardId,
      boardName: values.boardName,
      title: values.title,
      description: values.description,
      altText: values.altText,
      categoryId: values.categoryId,
      scheduledAt: postNow ? new Date() : scheduledAt,
      // No board yet (Pinterest not connected) → keep it as a draft that still holds its slot.
      status: values.boardId ? "scheduled" : "draft",
    })
    .returning({ id: pins.id });
  if (postNow) await publishPin(row.id);
  revalidatePath("/queue");
  redirect("/queue");
}

export async function updatePin(_prev: PinFormState, data: FormData): Promise<PinFormState> {
  const id = Number(data.get("id"));
  if (!id) return { error: "Missing pin id" };
  const s = await getSettings();
  const { fieldErrors, values } = validate(data, s.disclosureText);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const [cur] = await db.select().from(pins).where(eq(pins.id, id));
  if (!cur) return { error: "Pin not found" };
  if (cur.status === "posted") return { error: "This pin was already posted and can't be edited." };
  await db
    .update(pins)
    .set({
      imageUrl: values.imageUrl,
      destinationLink: values.destinationLink,
      boardId: values.boardId,
      boardName: values.boardName,
      title: values.title,
      description: values.description,
      altText: values.altText,
      categoryId: values.categoryId,
      scheduledAt: fromLocalInputValue(values.scheduledLocal, s.timezone),
      status: values.boardId ? "scheduled" : "draft",
      error: null,
      attempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(pins.id, id));
  revalidatePath("/queue");
  redirect("/queue");
}

export async function deletePin(formData: FormData) {
  const id = Number(formData.get("id"));
  if (id) await db.delete(pins).where(eq(pins.id, id));
  revalidatePath("/queue");
}

export async function retryPin(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  // Reset attempts so the manual retry always runs, then publish immediately.
  await db.update(pins).set({ attempts: 0, scheduledAt: new Date(), updatedAt: new Date() }).where(and(eq(pins.id, id), eq(pins.status, "failed")));
  await publishPin(id);
  revalidatePath("/queue");
}

export async function postPinNow(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.update(pins).set({ scheduledAt: new Date(), updatedAt: new Date() }).where(and(eq(pins.id, id), eq(pins.status, "scheduled")));
  await publishPin(id);
  revalidatePath("/queue");
}

export async function refreshBoards() {
  try {
    const boards = await getPublisher("pinterest").listBoards(true);
    revalidatePath("/pins/new");
    revalidatePath("/settings");
    return { ok: true as const, count: boards.length };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createPinterestBoard(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const privacy = formData.get("privacy") === "SECRET" ? "SECRET" : "PUBLIC";
  if (!name) return;
  try {
    const { createBoard } = await import("@/lib/platforms/pinterest");
    await createBoard(name, privacy);
    revalidatePath("/settings");
    revalidatePath("/pins/new");
    redirect("/settings?board=created");
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // let redirect() through
    redirect(`/settings?board=error&msg=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`);
  }
}

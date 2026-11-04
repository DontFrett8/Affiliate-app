import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings, type Pin } from "@/db/schema";
import type { Board, Publisher, PublishResult } from "./types";

/**
 * Make.com bridge: posts through Make's own approved Pinterest app.
 * Two Make scenarios, each starting with a Custom webhook:
 *  - POST webhook  → Pinterest "Create a Pin" → Webhook response with the new pin's ID as plain text
 *  - BOARDS webhook → Pinterest "List Boards" → Text aggregator ("{{id}}|{{name}}" per line) → Webhook response
 * Every request carries `key` (MAKE_WEBHOOK_KEY); the scenarios' filters drop anything without it.
 */
export function makeConfig() {
  const postUrl = process.env.MAKE_POST_WEBHOOK_URL?.trim();
  const boardsUrl = process.env.MAKE_BOARDS_WEBHOOK_URL?.trim();
  const key = process.env.MAKE_WEBHOOK_KEY?.trim();
  return { postUrl, boardsUrl, key, ready: !!(postUrl && key) };
}

async function callMake(url: string, payload: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(50_000),
  });
  const text = (await res.text()).trim();
  if (!res.ok) throw new Error(`Make.com ${res.status}: ${text.slice(0, 300) || res.statusText}`);
  if (/^accepted$/i.test(text)) {
    throw new Error("Make.com received the request but its scenario didn't send back a result. Open the scenario's History in Make to see what went wrong.");
  }
  return text;
}

/** Parse "id|name" lines from the boards scenario. */
export function parseBoardLines(text: string): Board[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("|");
      return i > 0 ? { id: l.slice(0, i).trim(), name: l.slice(i + 1).trim() || l.slice(0, i).trim() } : null;
    })
    .filter((b): b is Board => !!b && /^[0-9A-Za-z_-]+$/.test(b.id));
}

const BOARD_CACHE_MS = 7 * 24 * 60 * 60 * 1000; // boards rarely change; use "Reload boards" to refresh

export const makePublisher: Publisher = {
  platform: "pinterest",

  async isConnected() {
    return makeConfig().ready;
  },

  async listBoards(force = false) {
    const cfg = makeConfig();
    const [row] = await db.select({ boards: settings.makeBoards, at: settings.makeBoardsAt }).from(settings).where(eq(settings.id, 1));
    const fresh = row?.at && Date.now() - row.at.getTime() < BOARD_CACHE_MS;
    if (!force && fresh && row?.boards) return row.boards;
    if (!cfg.boardsUrl || !cfg.key) return row?.boards ?? [];
    const boards = parseBoardLines(await callMake(cfg.boardsUrl, { key: cfg.key, action: "boards" }));
    await db.update(settings).set({ makeBoards: boards, makeBoardsAt: new Date() }).where(eq(settings.id, 1));
    return boards;
  },

  async publish(pin: Pin): Promise<PublishResult> {
    const cfg = makeConfig();
    if (!cfg.postUrl || !cfg.key) throw new Error("Make.com isn't set up (MAKE_POST_WEBHOOK_URL / MAKE_WEBHOOK_KEY missing).");
    const text = await callMake(cfg.postUrl, {
      key: cfg.key,
      action: "post",
      board_id: pin.boardId,
      title: pin.title.slice(0, 100),
      description: pin.description.slice(0, 500),
      link: pin.destinationLink,
      image_url: pin.imageUrl,
      alt_text: pin.altText ?? "",
    });
    const id = text.replace(/^"|"$/g, "").trim();
    if (!/^\d{5,}$/.test(id)) throw new Error(`Make.com replied but didn't return a pin ID (got "${text.slice(0, 120)}"). Check the scenario's History in Make.`);
    return { externalId: id, externalUrl: `https://www.pinterest.com/pin/${id}/` };
  },
};

/** Sample payloads so Make can learn the data structure; the dummy key means they never post. */
export async function sendSetupSamples() {
  const cfg = makeConfig();
  const results: string[] = [];
  const sample = { key: "setup-sample", action: "post", board_id: "123", title: "Sample title", description: "Sample description", link: "https://www.amazon.com", image_url: "https://example.com/sample.png", alt_text: "" };
  for (const [name, url, body] of [
    ["Post", cfg.postUrl, sample],
    ["Boards", cfg.boardsUrl, { key: "setup-sample", action: "boards" }],
  ] as const) {
    if (!url) { results.push(`${name}: no webhook URL set`); continue; }
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
      results.push(`${name}: sent (${r.status})`);
    } catch (e) {
      results.push(`${name}: failed (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return results;
}

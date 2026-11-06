import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { aiClient } from "@/lib/copywriter";

export type Labeled = { type: string; variant: string };

const Labels = z.object({
  items: z.array(
    z.object({
      i: z.number().describe("The product's number from the list"),
      type: z.string().describe("Generic item type, 1-4 lowercase words"),
      variant: z.string().describe("Same-product key: brand + model, lowercase"),
    }),
  ),
});

const SYSTEM = `You label Amazon best-seller products so a shopper sees variety.

For every numbered product, return:
- type: what kind of item it is, in 1 to 4 lowercase words, generic and brand-free. Use the SAME label for items a shopper would see as interchangeable, even across brands, sizes or pack counts. Examples: "parchment paper", "vegetable peeler", "mascara", "makeup remover wipes", "hoop earrings", "crossbody bag", "women's leggings".
- variant: the specific product line, lowercase brand plus model, ignoring color, size, scent, shade and pack count. Two listings that are the same product in another color or size get the same variant.

Label every product in the list. Do not skip any.`;

/** Rough fallback when AI isn't available: first few title words stand in for both labels. */
export function heuristicLabels(titles: string[]): Labeled[] {
  return titles.map((t) => {
    const words = t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const key = words.slice(0, 4).join(" ");
    return { type: key, variant: key };
  });
}

export async function labelProducts(titles: string[], categoryName: string): Promise<{ labels: Labeled[]; source: "ai" | "heuristic"; note?: string }> {
  if (!titles.length) return { labels: [], source: "heuristic" };
  const c = await aiClient();
  if (!c) return { labels: heuristicLabels(titles), source: "heuristic", note: "AI not set up" };
  const list = titles.map((t, i) => `${i + 1}. ${t.slice(0, 180)}`).join("\n");
  const request = {
    model: c.model,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "low" as const, format: zodOutputFormat(Labels) },
    messages: [{ role: "user" as const, content: `Category: ${categoryName}\n\n${list}` }],
  };
  try {
    const res = c.direct
      ? await c.client.beta.messages.parse({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await c.client.messages.parse(request);
    if (res.stop_reason === "refusal" || !res.parsed_output) return { labels: heuristicLabels(titles), source: "heuristic", note: "AI gave no labels" };
    const fallback = heuristicLabels(titles);
    const byIndex = new Map(res.parsed_output.items.map((it) => [it.i, it]));
    const labels = titles.map((_, idx) => {
      const it = byIndex.get(idx + 1);
      return it?.type && it.variant ? { type: it.type.trim().toLowerCase(), variant: it.variant.trim().toLowerCase() } : fallback[idx];
    });
    return { labels, source: "ai" };
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `AI error ${err.status ?? ""}` : err instanceof Error ? err.message : String(err);
    console.error("labelProducts failed:", msg);
    return { labels: heuristicLabels(titles), source: "heuristic", note: msg.slice(0, 120) };
  }
}

/**
 * Keep the best-ranked product of each type (uniqueTypes) or of each product line (fashion),
 * preserving Amazon's order, up to `max`.
 */
export function pickVariety<T>(items: T[], labels: Labeled[], uniqueTypes: boolean, max: number): { item: T; label: Labeled }[] {
  const seen = new Set<string>();
  const out: { item: T; label: Labeled }[] = [];
  items.forEach((item, i) => {
    if (out.length >= max) return;
    const label = labels[i];
    const key = uniqueTypes ? `t:${label.type}` : `v:${label.variant}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ item, label });
  });
  return out;
}

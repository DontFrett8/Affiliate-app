import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getVercelOidcToken } from "@vercel/oidc";
import { z } from "zod";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { apiUsage } from "@/db/schema";
import { DESC_MAX, TITLE_MAX } from "@/lib/limits";

/** Hard monthly ceiling on AI calls so paid AI credits can't drain unexpectedly (~$0.001 each on Haiku). */
const AI_MONTHLY_CALLS = Number(process.env.PINFLOW_AI_MONTHLY_CALLS) || 500;

async function aiCallsThisMonth() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(apiUsage).where(and(eq(apiUsage.provider, "ai"), gte(apiUsage.createdAt, monthStart)));
  return Number(n);
}

/** Record one AI call (counts toward the monthly ceiling). */
export async function logAiCall(endpoint: string, ok: boolean) {
  await db.insert(apiUsage).values({ provider: "ai", endpoint: endpoint.slice(0, 200), ok }).catch(() => {});
}

export type CopyProduct = { title: string };
export type CopySuggestion = { title: string; description: string; source: "ai" | "template"; note?: string };

const PinCopy = z.object({
  title: z.string().describe("Pinterest pin title"),
  body: z.string().describe("Pin description body, without hashtags or disclosure"),
});

const SYSTEM = `You write Pinterest pin copy for an Amazon affiliate creator. Each pin is one image that groups several products and links to the creator's Amazon idea list.

Write:
- title: at most 90 characters. Lead with the search phrase a Pinterest user would type (for example "Fall Makeup Must-Haves", "Kitchen Gadgets Under the Radar"). Describe the theme that ties the products together; don't list every product. No emojis, no hashtags, no ALL CAPS.
- body: natural, friendly sentences that name the product types (not brands unless a brand is the main appeal) and say who they're for or when to use them, then a short call to action like "Tap to shop the full list." Stay within the character limit given in the request.

Rules (Amazon Associates and Pinterest policy):
- Never mention prices, discounts, sale claims, star ratings, review counts, rankings, or "best seller" status. They change and are not allowed to go stale in posts.
- No medical, health, or guaranteed-result claims (for example "cures acne", "regrows hair").
- Don't claim the creator personally tested an item. "Finds", "picks" and "favorites" are fine.
- No hashtags and no affiliate disclosure in your output; the app adds both.
- US English.`;

/** Server-side refusal fallbacks exist for the larger models only (not Haiku). */
export function supportsFallbacks(model: string) {
  return !/haiku/i.test(model);
}

/** Uses ANTHROPIC_API_KEY when set, otherwise Vercel AI Gateway via the deployment's OIDC token. */
export async function aiClient(): Promise<{ client: Anthropic; model: string; direct: boolean } | null> {
  if ((await aiCallsThisMonth().catch(() => 0)) >= AI_MONTHLY_CALLS) return null;
  if (process.env.ANTHROPIC_API_KEY) {
    return { client: new Anthropic(), model: process.env.PINFLOW_AI_MODEL || "claude-haiku-5-5", direct: true };
  }
  const gatewayKey = process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken().catch(() => null));
  if (!gatewayKey) return null;
  return {
    client: new Anthropic({ apiKey: gatewayKey, baseURL: "https://ai-gateway.vercel.sh" }),
    model: process.env.PINFLOW_AI_MODEL || "anthropic/claude-haiku-5.5",
    direct: false,
  };
}

/** Trim to `max` chars at a sentence or word boundary. */
export function fitText(text: string, max: number) {
  const t = text.trim().replace(/\s+\n/g, "\n");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1).trim();
  const word = cut.lastIndexOf(" ");
  return (word > 0 ? cut.slice(0, word) : cut).replace(/[,;:\-–—]+$/, "").trim() + "…";
}

/** Short product name: first chunk of an Amazon title, before "," "|" " - " "(", max 6 words. */
export function shortName(title: string) {
  const head = title.split(/\s[|–—-]\s|,|\(|\|/)[0].trim();
  return head.split(/\s+/).slice(0, 6).join(" ");
}

export function assembleDescription(body: string, hashtags: string, disclosure: string) {
  const tail = [hashtags.trim(), disclosure.trim()].filter(Boolean).join("\n\n");
  const room = DESC_MAX - (tail ? tail.length + 2 : 0);
  const fitted = fitText(body, Math.max(room, 0));
  return [fitted, tail].filter(Boolean).join("\n\n");
}

/** Free, instant fallback used when the AI isn't available. */
export function templateCopy(products: CopyProduct[], categoryName: string | null, hashtags: string, disclosure: string): CopySuggestion {
  const cat = categoryName ?? "Amazon";
  const names = products.map((p) => shortName(p.title)).filter(Boolean);
  const title = fitText(`${products.length > 1 ? `${products.length} ` : ""}${cat} Finds on Amazon You'll Want Right Now`, TITLE_MAX);
  const list = names.slice(0, 5).join(", ");
  const body = names.length
    ? `My current ${cat.toLowerCase()} picks: ${list}${names.length > 5 ? ", and more" : ""}. Tap to shop the full list on Amazon.`
    : `My current ${cat.toLowerCase()} picks. Tap to shop the full list on Amazon.`;
  return { title, description: assembleDescription(body, hashtags, disclosure), source: "template" };
}

export async function suggestPinCopy(opts: {
  products: CopyProduct[];
  categoryName: string | null;
  hashtags: string;
  disclosure: string;
}): Promise<CopySuggestion & { usage?: { input: number; output: number }; model?: string }> {
  const { products, categoryName, hashtags, disclosure } = opts;
  const fallback = (note: string) => ({ ...templateCopy(products, categoryName, hashtags, disclosure), note });
  if (!products.length) return fallback("No products selected.");

  const c = await aiClient();
  if (!c) return fallback("AI is off or this month's AI limit was reached, so this is a template.");

  const tail = [hashtags.trim(), disclosure.trim()].filter(Boolean).join("\n\n");
  const bodyMax = Math.max(120, DESC_MAX - (tail ? tail.length + 2 : 0) - 10);
  const list = products
    .slice(0, 20)
    .map((p, i) => `${i + 1}. ${p.title.slice(0, 200)}`)
    .join("\n");
  const user = `Category: ${categoryName ?? "mixed"}
Products in this pin:
${list}

Write the title (max 90 characters) and the body (max ${bodyMax} characters).`;

  const request = {
    model: c.model,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low" as const, format: zodOutputFormat(PinCopy) },
    messages: [{ role: "user" as const, content: user }],
  };

  try {
    const res =
      c.direct && supportsFallbacks(c.model)
        ? // Direct to Anthropic on a larger model: opt in to server-side refusal fallbacks.
          await c.client.beta.messages.parse({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
        : await c.client.messages.parse(request);
    if (res.stop_reason === "refusal") return fallback("The AI declined this one, so this is a template.");
    const out = res.parsed_output;
    if (!out?.title || !out.body) return fallback("The AI reply was empty, so this is a template.");
    return {
      title: fitText(out.title.replace(/#\w+/g, "").trim(), TITLE_MAX),
      description: assembleDescription(out.body.replace(/#\w+/g, "").trim(), hashtags, disclosure),
      source: "ai",
      model: res.model,
      usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("suggestPinCopy failed (raw):", raw.slice(0, 500));
    let msg = raw;
    if (raw.includes("customer_verification_required")) msg = "AI suggestions are off until a card is added in Vercel → AI Gateway (this unlocks free monthly credits)";
    else if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) msg = `AI access denied (${err.status})`;
    else if (err instanceof Anthropic.RateLimitError) msg = "AI is rate limited right now";
    else if (err instanceof Anthropic.APIError) msg = `AI error ${err.status ?? ""}: ${err.message}`.trim();
    console.error("suggestPinCopy failed:", msg);
    return fallback(`${msg.slice(0, 160)}. Showing a template instead.`);
  }
}

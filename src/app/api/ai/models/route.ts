import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";

export const dynamic = "force-dynamic";

/** Owner-only (behind login): which AI Gateway language models this team can use right now. */
export async function GET() {
  const token = process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken().catch(() => null));
  if (!token) return NextResponse.json({ error: "No AI Gateway credentials in this environment" }, { status: 500 });
  const res = await fetch("https://ai-gateway.vercel.sh/v1/models?include_availability", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ status: res.status, body: json }, { status: 502 });
  type M = { id: string; type?: string; pricing?: { input?: string; output?: string }; model_eligibility?: { status?: string; reason?: string } };
  const models = ((json.data ?? []) as M[]).filter((m) => (m.type ?? "language") === "language");
  const eligible = models
    .filter((m) => m.model_eligibility?.status === "eligible")
    .map((m) => ({ id: m.id, input: m.pricing?.input, output: m.pricing?.output }));
  const reasons = Object.fromEntries(models.filter((m) => m.id.startsWith("anthropic/")).map((m) => [m.id, m.model_eligibility ?? null]));
  return NextResponse.json({ eligibleCount: eligible.length, eligible, anthropic: reasons });
}

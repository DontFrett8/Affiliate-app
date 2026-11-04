"use client";

import Link from "next/link";
import { affiliateLink } from "@/lib/amazon";
import type { ProductView } from "./ProductCard";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // iOS fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function SelectionBar({ items, associateTag, onClear, onToast }: { items: ProductView[]; associateTag: string; onClear: () => void; onToast: (m: string) => void }) {
  if (items.length === 0) return null;

  async function copyForChatGPT() {
    const lines = items.map((p, i) => `${i + 1}. ${affiliateLink(p.asin, associateTag)}`);
    const ok = await copyText(lines.join("\n"));
    onToast(ok ? `Copied ${items.length} link${items.length === 1 ? "" : "s"} for ChatGPT` : "Copy failed — long-press to copy manually");
  }

  async function copyWithTitles() {
    const lines = items.map((p, i) => `${i + 1}. ${p.title}${p.priceDisplay ? ` — ${p.priceDisplay}` : ""}\n   ${affiliateLink(p.asin, associateTag)}`);
    const ok = await copyText(lines.join("\n"));
    onToast(ok ? "Copied links with titles" : "Copy failed");
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-40 px-3">
      <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-xl">
        <span className="px-2 text-sm font-semibold">{items.length} selected</span>
        <button className="btn-ghost !px-2 text-xs" onClick={onClear}>Clear</button>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary !px-3 text-xs" onClick={copyWithTitles} title="Links with product titles">+titles</button>
          <button className="btn-primary" onClick={copyForChatGPT}>Copy for ChatGPT</button>
          <Link href="/pins/new" className="btn-secondary !px-3" aria-label="Create pin">➕</Link>
        </div>
      </div>
      {!associateTag && <p className="mx-auto mt-1 max-w-xl text-center text-[11px] text-amber-700">No Associate tag set — links won&apos;t earn commission. Add it in Settings.</p>}
    </div>
  );
}

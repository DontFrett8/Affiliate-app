"use client";

import Link from "next/link";
import { Copy, Sparkles, X } from "lucide-react";
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
    const lines = items.map((p, i) => `${i + 1}. ${p.title}\n   ${affiliateLink(p.asin, associateTag)}`);
    const ok = await copyText(lines.join("\n"));
    onToast(ok ? "Copied links with product names" : "Copy failed");
  }

  return (
    <div className="animate-rise fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-40 px-4">
      <div className="mx-auto max-w-md rounded-[1.75rem] border border-border/70 bg-card/90 p-1.5 shadow-rose backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <button onClick={onClear} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2" aria-label="Clear selection">
            <X size={18} />
          </button>
          <span className="font-display grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-accent-soft px-2 text-base font-semibold text-accent-ink" aria-label={`${items.length} selected`}>
            {items.length}
          </span>
          <button className="btn-primary min-w-0 flex-1 !px-3" onClick={copyForChatGPT} onContextMenu={(e) => { e.preventDefault(); void copyWithTitles(); }}>
            <Copy size={15} className="shrink-0" /> <span className="truncate">Copy for ChatGPT</span>
          </button>
          <Link href="/pins/new" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink" aria-label="Create pin from selection">
            <Sparkles size={18} />
          </Link>
        </div>
        {!associateTag && (
          <p className="px-3 pb-1 pt-1.5 text-center text-[11px] font-medium text-warn-ink">Add your Associate tag in Settings so these links earn commission.</p>
        )}
      </div>
    </div>
  );
}

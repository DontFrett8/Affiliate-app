"use client";

import { useState } from "react";
import Link from "next/link";
import { zipSync } from "fflate";
import { ChevronDown, Copy, ExternalLink, Images, Link as LinkIcon, Loader2, Sparkles, X } from "lucide-react";
import { amazonImageAtSize } from "@/lib/amazon";
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

function fileName(i: number, title: string, type: string) {
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "product";
  return `${String(i + 1).padStart(2, "0")}-${slug}.${ext}`;
}

/** Fetch each selected product's photo (large size) through our own route. */
async function loadPhotos(items: ProductView[]) {
  const files: File[] = [];
  const failed: string[] = [];
  await Promise.all(
    items.map(async (p, i) => {
      if (!p.imageUrl) return failed.push(p.title);
      try {
        const res = await fetch(`/api/product-image?u=${encodeURIComponent(p.imageUrl)}`);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        files[i] = new File([blob], fileName(i, p.title, blob.type), { type: blob.type || "image/jpeg" });
      } catch {
        failed.push(p.title);
      }
    }),
  );
  return { files: files.filter(Boolean), failed };
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SelectionBar({ items, associateTag, onClear, onToast }: { items: ProductView[]; associateTag: string; onClear: () => void; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  if (items.length === 0) return null;

  async function savePhotos() {
    setBusy(true);
    try {
      const { files, failed } = await loadPhotos(items);
      if (!files.length) return onToast("Couldn't get the product photos. Try again.");
      const note = failed.length ? ` (${failed.length} couldn't be loaded)` : "";
      // Phones: open the share sheet ("Save Images" or send straight to the ChatGPT app).
      if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
        try {
          await navigator.share({ files, title: "Product photos" });
          onToast(`Shared ${files.length} photo${files.length === 1 ? "" : "s"}${note}`);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return; // user closed the sheet
        }
      }
      // Computers: one zip with every photo.
      const entries: Record<string, Uint8Array> = {};
      for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer());
      const zipped = zipSync(entries, { level: 0 });
      downloadBlob(new Blob([zipped.slice().buffer], { type: "application/zip" }), `pinflow-products-${new Date().toISOString().slice(0, 10)}.zip`);
      onToast(`Downloaded ${files.length} photo${files.length === 1 ? "" : "s"}${note}`);
    } finally {
      setBusy(false);
    }
  }

  async function copyLinks() {
    const lines = items.map((p, i) => `${i + 1}. ${affiliateLink(p.asin, associateTag)}`);
    const ok = await copyText(lines.join("\n"));
    onToast(ok ? `Copied ${items.length} link${items.length === 1 ? "" : "s"}` : "Copy failed — long-press to copy manually");
  }

  return (
    <div className="animate-rise fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-40 px-4">
      <div className="mx-auto max-w-md rounded-[1.75rem] border border-border/70 bg-card/90 p-1.5 shadow-rose backdrop-blur-xl">
        {showLinks && (
          <div className="mb-1.5 space-y-2 px-1.5 pt-1.5">
            <div className="flex items-center justify-between">
              <p className="font-display text-[15px] font-semibold">Your picks</p>
              <button className="btn-soft !px-3 !py-1.5 !text-xs" onClick={copyLinks}>
                <Copy size={13} /> Copy all links
              </button>
            </div>
            <ul className="max-h-[42vh] divide-y divide-border/60 overflow-y-auto rounded-2xl bg-card-2 ring-1 ring-border/60">
              {items.map((p, i) => (
                <li key={p.asin}>
                  <a
                    href={affiliateLink(p.asin, associateTag)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-card"
                  >
                    <span className="w-4 shrink-0 text-center text-xs font-semibold text-muted">{i + 1}</span>
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-border/60">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={amazonImageAtSize(p.imageUrl, 160) ?? p.imageUrl} alt="" className="h-full w-full object-contain p-0.5" />
                      )}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug">{p.title}</span>
                    <ExternalLink size={15} className="shrink-0 text-accent-ink" aria-label="Open on Amazon" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button onClick={onClear} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2" aria-label="Clear selection">
            <X size={18} />
          </button>
          <span className="font-display grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-accent-soft px-2 text-base font-semibold text-accent-ink" aria-label={`${items.length} selected`}>
            {items.length}
          </span>
          <button className="btn-primary min-w-0 flex-1 !px-3" onClick={savePhotos} disabled={busy}>
            {busy ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <Images size={15} className="shrink-0" />}
            <span className="truncate">{busy ? "Getting…" : "Photos"}</span>
          </button>
          <button
            onClick={() => setShowLinks((v) => !v)}
            aria-expanded={showLinks}
            className={`flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1 ring-border/60 ${showLinks ? "bg-accent-soft text-accent-ink" : "bg-card-2 text-foreground/80"}`}
          >
            <LinkIcon size={15} /> Links
            <ChevronDown size={13} className={`transition ${showLinks ? "rotate-180" : ""}`} />
          </button>
          <Link href="/pins/new" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink" aria-label="Create pin from selection">
            <Sparkles size={18} />
          </Link>
        </div>
        {!associateTag && (
          <p className="px-3 pb-1 pt-1.5 text-center text-[11px] font-medium text-warn-ink">Add your Associate tag in Settings so copied links earn commission.</p>
        )}
      </div>
    </div>
  );
}

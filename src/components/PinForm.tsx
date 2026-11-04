"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { createPin, refreshBoards, updatePin, type PinFormState } from "@/actions/pins";
import { suggestCopy } from "@/actions/copy";

type Picked = { asin: string; title: string; categoryId: number; imageUrl: string | null };
const SELECTION_KEY = "pinflow:selected";
const SUGGESTED_KEY = "pinflow:suggestedFor";

export type PinFormInitial = {
  id?: number;
  imageUrl: string;
  destinationLink: string;
  boardId: string;
  title: string;
  description: string;
  altText: string;
  scheduledAt: string; // datetime-local value in the user's zone
  categoryId: number | null;
};

export function PinForm(props: {
  initial: PinFormInitial;
  boards: { id: string; name: string; privacy?: string }[];
  categories: { id: number; name: string }[];
  disclosure: string;
  hashtags: string;
  timezone: string;
  pinterestConnected: boolean;
  blobConfigured: boolean;
  mode: "create" | "edit";
}) {
  const action = props.mode === "create" ? createPin : updatePin;
  const [state, formAction, submitting] = useActionState<PinFormState, FormData>(action, undefined);
  const [imageUrl, setImageUrl] = useState(props.initial.imageUrl);
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState(props.initial.title);
  const [description, setDescription] = useState(props.initial.description);
  const boards = props.boards;
  const [boardId, setBoardId] = useState(props.initial.boardId);
  const [boardsBusy, startBoards] = useTransition();
  const [boardsMsg, setBoardsMsg] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>(props.initial.categoryId ? String(props.initial.categoryId) : "");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const touched = useRef(false);
  const fe = state?.fieldErrors ?? {};

  const runSuggest = useCallback(
    async (items: Picked[], auto: boolean) => {
      if (!items.length) return;
      setSuggesting(true);
      setSuggestNote(null);
      try {
        const r = await suggestCopy({ titles: items.map((p) => p.title), categoryIds: items.map((p) => p.categoryId) });
        // Don't overwrite anything typed while the request was running.
        if (auto && touched.current) return;
        setTitle(r.title);
        setDescription(r.description);
        setSuggestNote(r.source === "ai" ? "Suggested by AI from your picks. Edit anything you like." : r.note ?? "Template suggestion.");
        try { localStorage.setItem(SUGGESTED_KEY, items.map((p) => p.asin).sort().join(",")); } catch {}
      } catch (err) {
        setSuggestNote(err instanceof Error ? err.message : "Couldn't get a suggestion.");
      } finally {
        setSuggesting(false);
      }
    },
    [],
  );

  // Load the products ticked on the Find tab; auto-suggest once per new selection when creating.
  useEffect(() => {
    let items: Picked[] = [];
    try {
      const raw = localStorage.getItem(SELECTION_KEY);
      if (raw) items = Object.values(JSON.parse(raw) as Record<string, Picked>).filter((p) => p && p.title);
    } catch {}
    if (!items.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating client-only state from localStorage
    setPicked(items);
    if (!categoryId) {
      const counts = new Map<number, number>();
      for (const p of items) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top && props.categories.some((c) => c.id === top)) setCategoryId(String(top));
    }
    if (props.mode !== "create") return;
    let last = "";
    try { last = localStorage.getItem(SUGGESTED_KEY) ?? ""; } catch {}
    const key = items.map((p) => p.asin).sort().join(",");
    if (key !== last) void runSuggest(items, true);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hasDisclosure = !props.disclosure || description.toLowerCase().includes(props.disclosure.toLowerCase());

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = await upload(`pins/${Date.now()}-${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        onUploadProgress: (p) => setUploading(Math.round(p.percentage)),
      });
      setImageUrl(blob.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  }

  function appendDisclosure() {
    setDescription((d) => (d.trim() ? `${d.trimEnd()}\n\n${props.disclosure}` : props.disclosure));
  }
  function appendHashtags() {
    if (!props.hashtags) return;
    setDescription((d) => (d.trim() ? `${d.trimEnd()}\n\n${props.hashtags}` : props.hashtags));
  }

  function loadBoards() {
    startBoards(async () => {
      const r = await refreshBoards();
      if (r.ok) {
        setBoardsMsg(`${r.count} boards loaded`);
        // Re-fetch the list via a lightweight API-free approach: reload page data.
        window.location.reload();
      } else setBoardsMsg(r.error);
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      {props.initial.id && <input type="hidden" name="id" value={props.initial.id} />}
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="boardName" value={boards.find((b) => b.id === boardId)?.name ?? ""} />

      {/* Image */}
      <section className="card space-y-3">
        <label className="label">Pin image (your ChatGPT creation)</label>
        <div className="flex gap-3">
          <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded-xl bg-background ring-1 ring-border">
            {imageUrl ? (
              <Image src={imageUrl} alt="" fill sizes="112px" className="object-cover" unoptimized />
            ) : (
              <div className="grid h-full place-items-center p-2 text-center text-[11px] text-muted">2:3 portrait works best (1000×1500)</div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <label className={`btn-secondary cursor-pointer ${!props.blobConfigured ? "opacity-50" : ""}`}>
              {uploading != null ? `Uploading ${uploading}%` : imageUrl ? "Replace image" : "Choose image"}
              <input type="file" accept="image/*" className="hidden" disabled={!props.blobConfigured || uploading != null} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {!props.blobConfigured && <p className="text-xs text-amber-700">BLOB_READ_WRITE_TOKEN not set — uploads disabled.</p>}
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
            {fe.imageUrl && <p className="text-xs text-red-600">{fe.imageUrl}</p>}
            {imageUrl && <p className="break-all text-[11px] text-muted">{imageUrl}</p>}
          </div>
        </div>
      </section>

      {/* Link + board */}
      <section className="card space-y-3">
        <div>
          <label className="label" htmlFor="destinationLink">Destination link (idea list / storefront)</label>
          <input id="destinationLink" name="destinationLink" className="input" inputMode="url" defaultValue={props.initial.destinationLink} placeholder="https://www.amazon.com/shop/yourname/list/…" />
          {fe.destinationLink && <p className="mt-1 text-xs text-red-600">{fe.destinationLink}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="boardId">Pinterest board</label>
            <button type="button" className="text-xs underline text-muted" onClick={loadBoards} disabled={boardsBusy || !props.pinterestConnected}>
              {boardsBusy ? "Loading…" : "Reload boards"}
            </button>
          </div>
          {boards.length ? (
            <select id="boardId" name="boardId" className="input" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
              <option value="">Choose a board…</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.privacy && b.privacy !== "PUBLIC" ? ` (${b.privacy.toLowerCase()})` : ""}</option>
              ))}
            </select>
          ) : (
            <div className="space-y-1">
              <input id="boardId" name="boardId" className="input" value={boardId} onChange={(e) => setBoardId(e.target.value)} placeholder="Leave empty to save as a draft" />
              <p className="text-xs text-muted">
                {props.pinterestConnected
                  ? "Tap “Reload boards” to fetch your boards."
                  : "Pinterest isn’t connected yet. Save without a board and it’s kept as a draft in your queue; pick the board once you connect."}
              </p>
            </div>
          )}
          {boardsMsg && <p className="mt-1 text-xs text-muted">{boardsMsg}</p>}
          {fe.boardId && <p className="mt-1 text-xs text-red-600">{fe.boardId}</p>}
        </div>
        <div>
          <label className="label" htmlFor="categoryId">Category (for your records)</label>
          <select id="categoryId" name="categoryId" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Copy */}
      <section className="card space-y-3">
        {picked.length > 0 ? (
          <div className="space-y-2 rounded-xl bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">✨ From your {picked.length} pick{picked.length === 1 ? "" : "s"}</p>
              <button
                type="button"
                className="btn-secondary !py-1 !text-xs"
                disabled={suggesting}
                onClick={() => { touched.current = false; void runSuggest(picked, false); }}
              >
                {suggesting ? "Writing…" : title || description ? "Suggest again" : "Suggest"}
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {picked.map((p) => (
                <div key={p.asin} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-border" title={p.title}>
                  {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="40px" className="object-contain p-0.5" unoptimized />}
                </div>
              ))}
            </div>
            {suggesting && <p className="text-xs text-muted">Writing a title and description for these products…</p>}
            {suggestNote && !suggesting && <p className="text-xs text-muted">{suggestNote}</p>}
          </div>
        ) : (
          props.mode === "create" && (
            <p className="text-xs text-muted">Tip: tick products on the Find tab first and PinFlow will write a title and description for them.</p>
          )
        )}
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="title">Title</label>
            <span className={`text-xs ${title.length > 100 ? "text-red-600" : "text-muted"}`}>{title.length}/100</span>
          </div>
          <input id="title" name="title" className="input" maxLength={100} value={title} onChange={(e) => { touched.current = true; setTitle(e.target.value); }} />
          {fe.title && <p className="mt-1 text-xs text-red-600">{fe.title}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="description">Description</label>
            <span className={`text-xs ${description.length > 500 ? "text-red-600" : "text-muted"}`}>{description.length}/500</span>
          </div>
          <textarea id="description" name="description" className="input min-h-40" maxLength={500} value={description} onChange={(e) => { touched.current = true; setDescription(e.target.value); }} />
          <div className="mt-2 flex flex-wrap gap-2">
            {!hasDisclosure && (
              <button type="button" className="btn-secondary !py-1 !text-xs" onClick={appendDisclosure}>+ Add disclosure</button>
            )}
            {props.hashtags && <button type="button" className="btn-secondary !py-1 !text-xs" onClick={appendHashtags}>+ Add hashtags</button>}
          </div>
          <p className={`mt-2 text-xs ${hasDisclosure ? "text-emerald-700" : "text-red-600"}`}>
            {hasDisclosure ? "✓ Affiliate disclosure included" : `Required: “${props.disclosure}”`}
          </p>
          {fe.description && <p className="mt-1 text-xs text-red-600">{fe.description}</p>}
        </div>
        <div>
          <label className="label" htmlFor="altText">Alt text (optional, accessibility)</label>
          <input id="altText" name="altText" className="input" maxLength={500} defaultValue={props.initial.altText} />
        </div>
      </section>

      {/* Schedule */}
      <section className="card space-y-2">
        <label className="label" htmlFor="scheduledAt">Post time ({props.timezone})</label>
        <input id="scheduledAt" name="scheduledAt" type="datetime-local" className="input" defaultValue={props.initial.scheduledAt} />
        <p className="text-xs text-muted">Pre-filled with your next open slot. Change it if you like.</p>
        {fe.scheduledAt && <p className="text-xs text-red-600">{fe.scheduledAt}</p>}
      </section>

      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" name="intent" value="schedule" className="btn-primary flex-1" disabled={submitting || uploading != null || !hasDisclosure}>
          {submitting ? "Saving…" : !boardId ? "Save as draft" : props.mode === "create" ? "Schedule pin" : "Save changes"}
        </button>
        {props.mode === "create" && (
          <button type="submit" name="intent" value="now" className="btn-secondary" disabled={submitting || uploading != null || !hasDisclosure || !props.pinterestConnected} title="Publish immediately">
            Post now
          </button>
        )}
      </div>
    </form>
  );
}

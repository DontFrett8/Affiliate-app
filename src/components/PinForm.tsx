"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { createPin, refreshBoards, updatePin, type PinFormState } from "@/actions/pins";

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
  const fe = state?.fieldErrors ?? {};
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
              <input id="boardId" name="boardId" className="input" value={boardId} onChange={(e) => setBoardId(e.target.value)} placeholder="Board ID (connect Pinterest to pick from a list)" />
              <p className="text-xs text-muted">{props.pinterestConnected ? "Tap “Reload boards” to fetch your boards." : "Pinterest isn’t connected yet — do that in Settings."}</p>
            </div>
          )}
          {boardsMsg && <p className="mt-1 text-xs text-muted">{boardsMsg}</p>}
          {fe.boardId && <p className="mt-1 text-xs text-red-600">{fe.boardId}</p>}
        </div>
        <div>
          <label className="label" htmlFor="categoryId">Category (for your records)</label>
          <select id="categoryId" name="categoryId" className="input" defaultValue={props.initial.categoryId ?? ""}>
            <option value="">—</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Copy */}
      <section className="card space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="title">Title</label>
            <span className={`text-xs ${title.length > 100 ? "text-red-600" : "text-muted"}`}>{title.length}/100</span>
          </div>
          <input id="title" name="title" className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
          {fe.title && <p className="mt-1 text-xs text-red-600">{fe.title}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="description">Description</label>
            <span className={`text-xs ${description.length > 500 ? "text-red-600" : "text-muted"}`}>{description.length}/500</span>
          </div>
          <textarea id="description" name="description" className="input min-h-40" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
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
          {submitting ? "Saving…" : props.mode === "create" ? "Schedule pin" : "Save changes"}
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

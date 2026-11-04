"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Send } from "lucide-react";
import { sendMakeSamples } from "@/actions/make";
import { refreshBoards } from "@/actions/pins";

export function MakeSetup(props: { postUrl: boolean; boardsUrl: boolean; keyValue: string | null; boardCount: number; active: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm">
        <Item ok={props.postUrl} label="Post webhook URL saved" />
        <Item ok={props.boardsUrl} label="Boards webhook URL saved" />
        <Item ok={!!props.keyValue} label="Security key set" />
        <Item ok={props.boardCount > 0} label={props.boardCount > 0 ? `${props.boardCount} boards loaded` : "Boards loaded"} />
      </ul>

      {props.keyValue && (
        <div>
          <p className="label">Security key (paste into both Make filters)</p>
          <div className="flex gap-2">
            <code className="input !py-2.5 select-all truncate font-mono !text-xs">{props.keyValue}</code>
            <button
              type="button"
              className="btn-secondary !px-3"
              onClick={async () => {
                await navigator.clipboard.writeText(props.keyValue!).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              aria-label="Copy key"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary !text-xs"
          disabled={pending || (!props.postUrl && !props.boardsUrl)}
          onClick={() => start(async () => setMsg((await sendMakeSamples()).join(" · ")))}
        >
          <Send size={13} /> Send setup samples
        </button>
        {props.active && (
          <button
            type="button"
            className="btn-secondary !text-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await refreshBoards();
                setMsg(r.ok ? `Loaded ${r.count} boards from Pinterest via Make.` : r.error);
              })
            }
          >
            Load boards
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-muted">{msg}</p>}
      <p className="text-xs text-muted">Setup samples use a dummy key, so they never post anything. They just teach Make what PinFlow sends.</p>
    </div>
  );
}

function Item({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? "bg-success-soft text-success-ink" : "bg-card-2 text-muted ring-1 ring-border"}`}>
        {ok ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className={ok ? "" : "text-muted"}>{label}</span>
    </li>
  );
}

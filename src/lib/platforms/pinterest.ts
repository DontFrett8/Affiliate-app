import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, type Pin } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import type { Board, Publisher, PublishResult } from "./types";

export const PINTEREST_SCOPES = ["boards:read", "pins:read", "pins:write", "user_accounts:read"];

export function pinterestEnv(): "sandbox" | "production" {
  return process.env.PINTEREST_ENV === "production" ? "production" : "sandbox";
}

/** Resource calls go to the sandbox host until Standard access is granted. OAuth always uses the real host. */
export function apiBase() {
  return pinterestEnv() === "production" ? "https://api.pinterest.com/v5" : "https://api-sandbox.pinterest.com/v5";
}
const OAUTH_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
export const OAUTH_AUTHORIZE_URL = "https://www.pinterest.com/oauth/";

function creds() {
  const id = process.env.PINTEREST_APP_ID;
  const secret = process.env.PINTEREST_APP_SECRET;
  if (!id || !secret) throw new Error("PINTEREST_APP_ID / PINTEREST_APP_SECRET are not set");
  return { id, secret, basic: Buffer.from(`${id}:${secret}`).toString("base64") };
}

/** Redirect URI registered in the Pinterest app. APP_URL wins so previews don't produce mismatched URIs. */
export function callbackUrl(requestOrigin: string) {
  const base = process.env.APP_URL?.replace(/\/$/, "") || requestOrigin;
  return `${base}/api/pinterest/callback`;
}

export function buildAuthorizeUrl(redirectUri: string, state: string) {
  const u = new URL(OAUTH_AUTHORIZE_URL);
  u.searchParams.set("client_id", creds().id);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", PINTEREST_SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${creds().basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pinterest token error ${res.status}: ${json?.message ?? JSON.stringify(json)}`);
  return json as TokenResponse;
}

async function saveTokens(t: TokenResponse, accountName?: string | null) {
  const now = Date.now();
  const values = {
    platform: "pinterest",
    accessTokenEnc: await encrypt(t.access_token),
    refreshTokenEnc: t.refresh_token ? await encrypt(t.refresh_token) : undefined,
    accessExpiresAt: new Date(now + t.expires_in * 1000),
    refreshExpiresAt: t.refresh_token_expires_in ? new Date(now + t.refresh_token_expires_in * 1000) : undefined,
    scopes: t.scope,
    environment: pinterestEnv(),
    updatedAt: new Date(),
    ...(accountName !== undefined ? { accountName } : {}),
  };
  await db
    .insert(connections)
    .values({ ...values, connectedAt: new Date() })
    .onConflictDoUpdate({ target: connections.platform, set: values });
}

export async function exchangeCode(code: string, redirectUri: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, continuous_refresh: "true" });
  await saveTokens(t, null);
  // Fetch the username for display (needs user_accounts:read).
  try {
    const me = await apiFetch("/user_account");
    await db.update(connections).set({ accountName: me?.username ?? null }).where(eq(connections.platform, "pinterest"));
  } catch {
    /* non-fatal */
  }
}

export async function getConnection() {
  const [row] = await db.select().from(connections).where(eq(connections.platform, "pinterest"));
  return row ?? null;
}

export async function disconnect() {
  await db.delete(connections).where(eq(connections.platform, "pinterest"));
}

/** Returns a valid access token, refreshing it when it expires within 10 minutes. */
async function accessToken(): Promise<string> {
  const row = await getConnection();
  if (!row) throw new Error("Pinterest is not connected. Open Settings → Connect Pinterest.");
  const soon = Date.now() + 10 * 60 * 1000;
  if (row.accessExpiresAt && row.accessExpiresAt.getTime() > soon) return decrypt(row.accessTokenEnc);
  if (!row.refreshTokenEnc) throw new Error("Pinterest access token expired and no refresh token stored. Reconnect Pinterest.");
  if (row.refreshExpiresAt && row.refreshExpiresAt.getTime() < Date.now()) {
    throw new Error("Pinterest refresh token expired. Reconnect Pinterest in Settings.");
  }
  const t = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: await decrypt(row.refreshTokenEnc),
    scope: PINTEREST_SCOPES.join(","),
  });
  // Pinterest may or may not rotate the refresh token; keep the old one if none returned.
  await saveTokens(t.refresh_token ? t : { ...t, refresh_token: undefined });
  return t.access_token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function apiFetch(path: string, init?: RequestInit & { json?: unknown }): Promise<any> {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = json?.message ?? json?.error_description ?? text.slice(0, 300);
    throw new Error(`Pinterest ${res.status}: ${msg}`);
  }
  return json;
}

/** Pinterest-specific helper (not part of the generic Publisher interface): create a board. Handy in the sandbox, which starts empty. */
export async function createBoard(name: string, privacy: "PUBLIC" | "SECRET" = "PUBLIC"): Promise<Board> {
  const b = await apiFetch("/boards", { method: "POST", json: { name, privacy } });
  const board = { id: String(b.id), name: String(b.name), privacy: b.privacy };
  const row = await getConnection();
  await db.update(connections).set({ boards: [...(row?.boards ?? []), board], boardsFetchedAt: new Date() }).where(eq(connections.platform, "pinterest"));
  return board;
}

export const pinterestPublisher: Publisher = {
  platform: "pinterest",

  async isConnected() {
    return !!(await getConnection());
  },

  async listBoards(force = false) {
    const row = await getConnection();
    if (!row) return [];
    const fresh = row.boardsFetchedAt && Date.now() - row.boardsFetchedAt.getTime() < 6 * 60 * 60 * 1000;
    if (!force && fresh && row.boards) return row.boards;
    const boards: Board[] = [];
    let bookmark: string | undefined;
    do {
      const q = new URLSearchParams({ page_size: "100", ...(bookmark ? { bookmark } : {}) });
      const page = await apiFetch(`/boards?${q}`);
      for (const b of page.items ?? []) boards.push({ id: String(b.id), name: String(b.name), privacy: b.privacy });
      bookmark = page.bookmark ?? undefined;
    } while (bookmark);
    await db.update(connections).set({ boards, boardsFetchedAt: new Date() }).where(eq(connections.platform, "pinterest"));
    return boards;
  },

  async publish(pin: Pin): Promise<PublishResult> {
    const created = await apiFetch("/pins", {
      method: "POST",
      json: {
        board_id: pin.boardId,
        title: pin.title.slice(0, 100),
        description: pin.description.slice(0, 800),
        link: pin.destinationLink,
        alt_text: pin.altText || undefined,
        media_source: { source_type: "image_url", url: pin.imageUrl },
      },
    });
    const id = String(created.id);
    return { externalId: id, externalUrl: `https://www.pinterest.com/pin/${id}/` };
  },
};

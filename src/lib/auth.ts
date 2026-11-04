import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "pinflow_session";
const SESSION_DAYS = 30;

async function secretKey() {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD is not set");
  // Derive a stable signing key from the password (single-user app).
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pinflow-session:${pw}`));
  return new Uint8Array(digest);
}

export function passwordMatches(candidate: string) {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected || candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken() {
  return new SignJWT({ u: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await secretKey());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, await secretKey());
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

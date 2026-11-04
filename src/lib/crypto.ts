/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 * Key is derived from PINTEREST_APP_SECRET + APP_PASSWORD so no extra env var is needed.
 */
async function key() {
  const material = `${process.env.PINTEREST_APP_SECRET ?? ""}|${process.env.APP_PASSWORD ?? ""}`;
  if (material === "|") throw new Error("Set PINTEREST_APP_SECRET and APP_PASSWORD before storing tokens");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pinflow-token-key:${material}`));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

const b64 = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

export async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plain));
  return `${b64(iv)}.${b64(data)}`;
}

export async function decrypt(enc: string) {
  const [ivB64, dataB64] = enc.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB64) }, await key(), unb64(dataB64));
  return new TextDecoder().decode(plain);
}

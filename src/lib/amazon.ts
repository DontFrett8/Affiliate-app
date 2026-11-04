const ASIN_RE = /\b(B0[A-Z0-9]{8}|[0-9]{9}[0-9X])\b/;

/** Pull an ASIN out of any amazon.com URL (dp/, gp/product/, ASIN query, short forms) or a bare ASIN. */
export function extractAsin(input: string): string | null {
  const s = input.trim();
  if (/^[A-Z0-9]{10}$/i.test(s)) return s.toUpperCase();
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?]|$)/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && ASIN_RE.test(m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return null;
}

/** Plain, visible amazon.com link with the Associate tag — no shorteners or cloaking. */
export function affiliateLink(asin: string, tag: string) {
  const base = `https://www.amazon.com/dp/${asin}`;
  return tag ? `${base}?tag=${encodeURIComponent(tag)}` : base;
}

/** Split a pasted blob of text into candidate links/ASINs. */
export function parsePastedLinks(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

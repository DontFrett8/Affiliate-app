import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-6 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">PinFlow Privacy Policy</h1>
      <p className="text-muted">Last updated: November 4, 2026</p>

      <p>
        PinFlow is a private, single-user tool that its owner uses to plan and publish Pins to their own Pinterest account. It is not offered to the public and does not collect information from the public.
      </p>

      <h2 className="text-lg font-semibold">What PinFlow accesses</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Pinterest:</strong> with the owner&apos;s permission (OAuth 2.0; scopes <code>boards:read</code>, <code>pins:read</code>, <code>pins:write</code>, <code>user_accounts:read</code>), PinFlow reads the owner&apos;s board list and account username and creates Pins the owner has written and scheduled.</li>
        <li><strong>Amazon product data:</strong> public best-seller listings (title, image, price, rating, link) retrieved through a third-party API (Canopy) for the owner&apos;s own research. No Amazon customer data is involved.</li>
        <li><strong>Images:</strong> images the owner uploads for their Pins, stored on Vercel Blob at public URLs so Pinterest can fetch them.</li>
      </ul>

      <h2 className="text-lg font-semibold">How data is stored and used</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Pinterest access and refresh tokens are stored encrypted in a private Postgres database (Neon) and are used only to perform the actions above on the owner&apos;s behalf.</li>
        <li>Scheduled Pin content, settings and cached product lists are stored in the same database.</li>
        <li>No data is sold, shared with advertisers, or used for any purpose other than operating the app for its owner.</li>
        <li>No cookies are used other than a login session cookie for the owner.</li>
      </ul>

      <h2 className="text-lg font-semibold">Affiliate disclosure</h2>
      <p>Pins created with PinFlow link to Amazon as part of the Amazon Associates program, and every Pin carries the disclosure: &quot;As an Amazon Associate I earn from qualifying purchases.&quot; PinFlow is used for organic Pins only.</p>

      <h2 className="text-lg font-semibold">Deleting data</h2>
      <p>The owner can disconnect Pinterest at any time from Settings, which deletes the stored tokens, and can revoke access from Pinterest&apos;s own settings. Deleting the app&apos;s database removes all remaining data.</p>

      <h2 className="text-lg font-semibold">Contact</h2>
      <p>Questions about this policy can be sent to the app owner via the contact email listed on the Pinterest app registration.</p>

      <p><Link href="/" className="underline">← Back to PinFlow</Link></p>
    </main>
  );
}

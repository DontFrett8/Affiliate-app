# PinFlow

A private, mobile-first web app that streamlines the **Amazon affiliate → Pinterest** workflow:

1. **Find** – pull the current Amazon Best Sellers for your categories (via [Canopy API](https://canopyapi.co)), cached in Postgres.
2. **Pick** – tick products, tap **Copy for ChatGPT** to get a numbered list of tagged `amazon.com/dp/ASIN?tag=…` links.
3. *(You make the image in ChatGPT and update your Amazon idea list yourself.)*
4. **Create pin** – upload the image (Vercel Blob), paste the destination link, pick a board, edit title/description. The affiliate disclosure is mandatory.
5. **Schedule** – pins auto-fill your next open daily slot (default 9:00, 12:30, 17:00, 20:30 America/Chicago).
6. **Post** – a job hits `/api/cron/publish` every 5–15 minutes and publishes due pins through the Pinterest API v5.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Neon Postgres · Vercel Blob · Pinterest API v5 · Canopy API.

---

## 1. What you need to sign up for (and what it costs)

| Service | Why | Cost |
|---|---|---|
| **Canopy API** – <https://www.canopyapi.co> → Sign up → Dashboard → copy API key | Amazon best-seller data | Free: 100 requests/month. After that ≈ $0.01/request (pay-as-you-go). One **Get top sellers** for 12 categories = 12 requests, so refreshing 2× a week ≈ 100/month — right at the free cap. |
| **Pinterest developer app** – <https://developers.pinterest.com/apps/> → Connect app | OAuth + posting | Free. Starts in **Trial access** (pins only visible to you / sandbox). **Standard access** requires submitting a screen-recorded demo (script below). |
| **Vercel** (already connected) | Hosting + Blob storage + optional cron | Hobby: $0 (crons limited to **once per day**). Pro: $20/month (crons every minute, team features). See §6. |
| **Neon** (already connected) | Postgres | Free plan covers this easily (project `pinflow` already created). |
| **cron-job.org** – <https://cron-job.org> (only if you stay on Vercel Hobby) | Calls the publish endpoint every 10 min | Free. |

**Expected monthly cost on Hobby + free tiers: $0–$3** (only Canopy overage if you refresh a lot). On Vercel Pro: ~$20–23.

---

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview). Never commit them.

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → project **pinflow** → Connect → copy the pooled connection string (already set by the setup session). |
| `APP_PASSWORD` | Anything long; it's the only login. (A random one was set for you; change it any time.) |
| `CANOPY_API_KEY` | canopyapi.co → Dashboard. |
| `BLOB_READ_WRITE_TOKEN` | Created automatically when the Blob store is linked to the project (Vercel → Storage). |
| `CRON_SECRET` | Any long random string. The cron caller sends it as `?key=` or `Authorization: Bearer`. (A random one was set for you.) |
| `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` | developers.pinterest.com → My apps → your app → App ID / App secret. |
| `PINTEREST_ENV` | `sandbox` (default) until Standard access is approved, then `production`. |
| `APP_URL` | Your production URL, e.g. `https://pinflow-iota.vercel.app`. Used to build the OAuth redirect URI so previews don't mismatch. |

After changing env vars, **redeploy** (Vercel → Deployments → ⋯ → Redeploy).

Local dev: copy `.env.example` → `.env.local`, then `pnpm install && pnpm db:push && pnpm dev`.

---

## 3. Pinterest app setup (step by step)

1. Go to <https://developers.pinterest.com/apps/> and **Connect app**. Fill in:
   - App name: *PinFlow*, description: *Personal tool that schedules my own organic Pins.*
   - **Redirect URI**: `https://pinflow-iota.vercel.app/api/pinterest/callback` (also shown on the app's Settings page).
   - **Privacy policy URL**: `https://pinflow-iota.vercel.app/privacy`.
   - Scopes: `boards:read`, `pins:read`, `pins:write`, `user_accounts:read`.
2. Copy **App ID** and **App secret** into Vercel env vars `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET`, keep `PINTEREST_ENV=sandbox`, redeploy.
3. In PinFlow → **Settings → Connect Pinterest**. Approve the consent screen. You'll land back on Settings showing *Connected as @you*.
4. Your boards load into the dropdown on **Create pin** (sandbox has its own boards; create one in the sandbox if the list is empty — see Pinterest's sandbox docs).
5. Tokens: Pinterest access tokens last ~30 days and refresh tokens ~1 year. PinFlow refreshes automatically (continuous refresh) and stores both **AES-256-GCM encrypted** in Postgres. If the refresh token ever expires you'll see *Reconnect Pinterest* in the queue errors.

### Trial → Standard access

While in **Trial access** your pins are not distributed (only you can see them), and with `PINTEREST_ENV=sandbox` calls go to `api-sandbox.pinterest.com` so nothing touches your real profile.
To go live, request **Standard access** from your app's page. Pinterest asks for a screen recording showing the OAuth flow and a pin being created. Use this script:

#### Demo recording script (≈2 minutes)

> Record your phone or desktop screen. Narration is optional but helps; keep the app's URL visible.

1. **0:00** – Open PinFlow, show the sign-in screen, sign in. Say: *"PinFlow is a personal, single-user tool I built to schedule my own organic Pins."*
2. **0:15** – Go to **Settings**. Point at the Pinterest section (not connected). Tap **Connect Pinterest**.
3. **0:25** – On Pinterest's consent screen, show the requested scopes (boards, pins, user account) and tap **Give access**.
4. **0:40** – Back in PinFlow Settings, show *Connected as @username* and the board count. Say: *"Tokens are stored encrypted server-side and refreshed automatically."*
5. **0:55** – Go to **Create**. Upload an image you made, paste your destination link, pick a board from the dropdown, show the title/description (point out the disclosure line is required). Tap **Post now**.
6. **1:30** – Go to **Queue**, show the pin with status **posted** and tap **View on Pinterest** to show the created Pin.
7. **1:50** – Briefly show `/privacy`. End.

Submit the recording with a short description such as: *"Single-user personal scheduling tool. Uses boards:read to list my boards, pins:write to create my own organic Pins at scheduled times, pins:read to confirm creation, user_accounts:read to show which account is connected. No ads, no third-party users."*

Once approved: set `PINTEREST_ENV=production`, redeploy, and **Reconnect** in Settings (the sandbox token is a separate environment).

---

## 4. Canopy / Amazon categories

Each category stores an Amazon Best Sellers target that Canopy accepts:

- a full best-sellers page URL (recommended, lets you target sub-categories), e.g. `https://www.amazon.com/gp/bestsellers/beauty/11058281` (Makeup)
- a numeric node ID (`11058281`)
- or a top-level slug (`bestsellers_beauty`)

Defaults (all node IDs verified via Canopy on 2026-11-04; change any of them with **Settings → Browse Amazon best-seller categories**, which drills through Amazon's own tree at 1 request per level):

| Category | Default target |
|---|---|
| Women's Fashion | fashion/7147440011 |
| Seasonal Fashion | fashion/1040660 (Women's Clothing — pick a seasonal child) |
| Makeup | beauty/11058281 |
| Skincare | beauty/11060451 |
| Hair Care | beauty/11057241 |
| Hair Tools | beauty/11058091 (Styling Tools & Appliances) |
| Hairstyles & Accessories | beauty/11057971 (Hair Accessories) |
| Holiday Decor | home-garden/13679381 (Amazon's "Seasonal Décor", which is the holiday department: ornaments, trees, lights, wreaths…) |
| Home Decor | home-garden/1063278 |
| Seasonal Decor | home-garden/13679411 (Wreaths, Garlands & Swags) — swap for e.g. Outdoor Holiday Decorations 285033011 or Home Décor Accents 3735061 |
| Kitchen Gadgets | kitchen/289745 |
| Baking | kitchen/289668 |

Request budget: **Get top sellers** = 1 request per category; **Refresh this** = 1; pasting links with *look up details* = 1 per new ASIN (untick it to spend nothing). The Find page shows this month's count.

---

## 5. Rules baked in

- Links are plain `https://www.amazon.com/dp/ASIN?tag=YOURTAG` – no shorteners, no cloaking.
- Every pin description must contain your disclosure text (default *"#ad As an Amazon Associate I earn from qualifying purchases."*); the form won't save without it.
- Organic posting only. Nothing here touches Pinterest Ads.
- Amazon product images are only displayed for picking; pins use your own uploaded images.
- No Amazon automation or scraping: product data comes from Canopy, and the idea list is maintained by you.
- Posting is modular (`src/lib/platforms/`): add `facebook.ts` implementing `Publisher` and register it in `index.ts` when you're ready.

---

## 6. The posting job (Hobby vs Pro)

Pinterest has no scheduler, so something must call `GET https://pinflow-iota.vercel.app/api/cron/publish?key=<CRON_SECRET>` every 5–15 minutes.

| Option | Cost | Setup |
|---|---|---|
| **Vercel Hobby + cron-job.org** (default) | $0 | cron-job.org → Create cronjob → URL above → every 10 minutes → Save. The included `vercel.json` daily cron is only a safety net. |
| **Vercel Pro** | $20/mo | Change `vercel.json` schedule to `*/10 * * * *`; Vercel calls the endpoint with the `CRON_SECRET` header automatically. |

Tradeoff: cron-job.org is free and perfectly reliable for this; Pro buys you one less moving part (and better logs/analytics) but costs more than the rest of the stack combined. Pins post within ~10 minutes of their slot either way.

The job claims each due pin atomically, so overlapping runs can't double-post. Failed pins retry on later runs (max 3) and can always be retried manually from the Queue.

---

## 7. Project layout

```
src/
  app/(app)/            Find (/), Create (/pins/new), Edit, Queue, Settings  (behind login)
  app/login, /privacy   public pages
  app/api/cron/publish  secret-protected publish job
  app/api/pinterest/*   OAuth start / callback / disconnect
  app/api/blob/upload   token endpoint for direct browser → Blob uploads
  actions/              server actions (settings, products, pins, browse)
  lib/canopy.ts         Canopy REST client (+ usage logging)
  lib/platforms/        Publisher interface, Pinterest implementation, registry
  lib/publish.ts        due-pin runner
  lib/schedule.ts       next-open-slot logic (time-zone aware)
  db/schema.ts          Drizzle schema (settings, categories, products, pins, connections, api_usage)
```

Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm db:push` (apply schema to Neon), `pnpm db:studio`.

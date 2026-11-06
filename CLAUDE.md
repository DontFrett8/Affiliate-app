# PinFlow — working rules

## Spending money (owner's standing rule)
- Never take any action that can cost money on Vercel without telling the owner first and getting a yes. This includes upgrading the plan (e.g. Pro), buying AI Gateway credits or enabling auto top-up, buying domains, adding paid Marketplace integrations, enabling paid add-ons (Observability Plus, Speed Insights, extra Blob/Edge Config capacity), and anything that bills the card on file.
- The same applies to every other paid service this app uses (Canopy API overage, Neon paid plans, Pinterest, Anthropic API). State the expected cost before doing it.
- Running features that draw from free monthly credits (e.g. AI title suggestions via AI Gateway) is allowed, but say so when a change increases that usage.
- When unsure whether something costs money, ask first.

## Project notes
- Stack: Next.js 16 App Router, Drizzle + Neon Postgres, Vercel Blob, Pinterest API v5, Canopy API, Claude Haiku 5.5 via Vercel AI Gateway (`src/lib/copywriter.ts`; Opus is not in the free gateway tier, override with PINFLOW_AI_MODEL). AI calls capped at 500/month (PINFLOW_AI_MONTHLY_CALLS), then free fallbacks..
- Vercel team `dont-frett`, project `pinflow`; production deploys from branch `claude/pinflow-pinterest-scheduler-cmka3p`.
- Posting is triggered every 10 min by an external cron-job.org job hitting `/api/cron/publish?key=CRON_SECRET`.
- Pinterest posting routes through `src/lib/platforms/index.ts`: direct API when connected, else the Make.com bridge (`src/lib/platforms/make.ts`, env `MAKE_POST_WEBHOOK_URL`, `MAKE_BOARDS_WEBHOOK_URL`, `MAKE_WEBHOOK_KEY`; setup in `docs/MAKE_SETUP.md` and the Word version `docs/PinFlow-Make-Setup-Guide.docx`). Make Free plan: ~3 credits per pin.
- Discover: best-seller refresh pulls 50 per Canopy lookup, labels types with one AI call (`src/lib/sorter.ts`) and keeps 15 varied picks (per-category `uniqueTypes`). In-app Amazon search (`src/actions/search.ts`) caches results 7 days. All Canopy calls stop at `settings.canopyMonthlyLimit` (default 100 = free tier).
- Schema changes: edit `src/db/schema.ts`, then `pnpm db:push`.

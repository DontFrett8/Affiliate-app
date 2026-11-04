# PinFlow — working rules

## Spending money (owner's standing rule)
- Never take any action that can cost money on Vercel without telling the owner first and getting a yes. This includes upgrading the plan (e.g. Pro), buying AI Gateway credits or enabling auto top-up, buying domains, adding paid Marketplace integrations, enabling paid add-ons (Observability Plus, Speed Insights, extra Blob/Edge Config capacity), and anything that bills the card on file.
- The same applies to every other paid service this app uses (Canopy API overage, Neon paid plans, Pinterest, Anthropic API). State the expected cost before doing it.
- Running features that draw from free monthly credits (e.g. AI title suggestions via AI Gateway) is allowed, but say so when a change increases that usage.
- When unsure whether something costs money, ask first.

## Project notes
- Stack: Next.js 16 App Router, Drizzle + Neon Postgres, Vercel Blob, Pinterest API v5, Canopy API, Claude via Vercel AI Gateway (`src/lib/copywriter.ts`).
- Vercel team `dont-frett`, project `pinflow`; production deploys from branch `claude/pinflow-pinterest-scheduler-cmka3p`.
- Posting is triggered every 10 min by an external cron-job.org job hitting `/api/cron/publish?key=CRON_SECRET`.
- Schema changes: edit `src/db/schema.ts`, then `pnpm db:push`.

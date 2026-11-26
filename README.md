# SignalScout — Free Buying-Intent Reader

Find people asking for a tool like yours on **Reddit, X, LinkedIn, and Hacker News** — 100% free.

SignalScout scans social threads for recommendation requests, competitor frustrations, and active buying questions, filters out promotional noise and listicles with a two-stage intent pipeline, explains in quiet margin notes why each post was flagged, drafts an editable non-salesy reply, and sends alerts to Slack or Discord.

## 100% Free — All Channels Included

| Capability | SignalScout | Syften | Octolens |
| --- | --- | --- | --- |
| Pricing | **$0 (100% free)** | $29.95/mo base + $40/mo X + $20/mo YouTube | Tiered seat & volume plans |
| Reddit & Hacker News live scanning | Included (10-min cron + on-demand) | Included | Included |
| X & LinkedIn coverage | Included ($0 add-on via API or webhook bridge) | +$40/mo X add-on | Plan-gated |
| Two-stage LLM noise filter | Included + Filtered Out log | Keyword rules | AI relevance scoring |
| Contextual reply drafts | Included (Hook + helpful points + soft disclosure) | Manual | Alert-first |

## Architecture
- **Frontend:** Vite + React + TypeScript + Tailwind CSS (`src/client/*`) — calm light reading desk layout
- **Backend API & Cron:**
  - **Netlify:** `netlify/functions/api.mts` (`/api/*`) + `netlify/functions/cron-poll.mts` (10-minute scheduled scan) + `netlify.toml`
  - **Vercel:** `api/index.ts` (Web API `GET`/`POST`/`PATCH`/`PUT`/`DELETE` handler) + `vercel.json`
- **Database:** Managed Postgres (`@netlify/database` with SQL migrations in `netlify/database/migrations/`) with automatic fallback to `MemoryDb` when `NETLIFY_DB_URL` / `DATABASE_URL` is not configured
- **LLM Engine:** OpenAI SDK / Netlify AI Gateway / custom OpenAI key / deterministic heuristic scorer

## Quick Start
```bash
npm install
npm run dev
```
Run tests, typecheck, and production build:
```bash
npm test
npx tsc --noEmit
npm run build
```

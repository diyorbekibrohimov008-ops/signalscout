# SignalScout — All-Channel Buying-Intent Listening ($25/mo Flat)

SignalScout monitors **Reddit, X, LinkedIn, and Hacker News** for high-intent customer conversations (product recommendation requests, competitor complaints, explicit purchasing intent), filters out noisy keyword spam with a two-stage LLM intent pipeline, and delivers actionable Slack & Discord alerts containing an authentic **Contextual Reply Outline**.

> [!WARNING]
> **Project Status — Work in Progress (Not Fully Ready)**
> This project is currently under active development and is **not fully ready for production**. Some parts, features, or workflow steps will fail or behave unexpectedly. We are actively working on fixing all remaining issues.

## Why Teams Switch from Syften & Octolens
- **All-Channel Flat Pricing ($25/mo):** Reddit, X, LinkedIn, and Hacker News included with zero channel add-ons.
- **Two-Stage LLM Intent Filtering:** Drops job posts, promo spam, and irrelevant keyword hits before they ever hit Slack (while logging blocked noise in an audit tab).
- **Contextual Reply Assistant:** Drafts a non-salesy 3-part reply (Hook -> Value Points -> Soft Disclosure) right inside each Slack notification.

## Architecture
- **Frontend:** Vite + React + TypeScript + Tailwind CSS (`src/client/*`)
- **Backend API & Cron:**
  - **Netlify:** `netlify/functions/api.mts` (`/api/*`) + `netlify/functions/cron-poll.mts` (10-minute scheduled monitor) + `netlify.toml`
  - **Vercel:** `api/index.ts` (Web API `GET`/`POST`/`PATCH`/`PUT`/`DELETE` handler) + `vercel.json`
- **Database:** Managed Postgres (`@netlify/database` with SQL migrations in `netlify/database/migrations/`) with automatic fallback to `MemoryDb` when `NETLIFY_DB_URL` / `DATABASE_URL` is not configured
- **LLM Engine:** OpenAI SDK / Netlify AI Gateway / custom OpenAI key / deterministic heuristic scorer

# SignalScout MVP Implementation Plan

**Goal:** Build and deploy a 24/7 online full-stack SaaS MVP ("SignalScout") for all-channel social buying-intent listening across Reddit, X, LinkedIn, and Hacker News at \$25/month flat.

**Architecture:** Vite + React + Tailwind SPA backed by Netlify Functions (`netlify/functions/api.mts`), Netlify Scheduled Functions (`cron-poll.mts` running every 10 minutes), Netlify Database (managed Postgres via `@netlify/database` + SQL migrations), and Netlify AI Gateway (`openai` SDK) with deterministic buying-intent fallback.

**Platform Decision:** Railway workspace trial expired (`Your trial has expired`), Vercel plugin is unauthenticated; Netlify MCP is authenticated on a fresh Credit-based Free plan supporting 24/7 static hosting, Functions, Scheduled Functions, Postgres (`@netlify/database`), and AI Gateway.

## Milestones
1. Core Domain & TDD Suite (`src/lib/types.ts`, `intent.ts`, `reply.ts`, `notifier.ts`, `auth.ts`, `channels/*.ts`, `db.ts`, `pipeline.ts`)
2. Netlify Functions API & Cron (`netlify/functions/api.mts`, `netlify/functions/cron-poll.mts`)
3. React SaaS Frontend (Landing/Syften Cost Switcher, Interactive Intent Playground, Auth, Intent Inbox + Noise Audit, Contextual Reply Personalizer, Monitors, Integrations, \$25/mo Billing)
4. Verification (`vitest run`, `tsc --noEmit`, `vite build`, local dev smoke test)
5. Netlify Production Deployment (`netlify deploy --prod`) & Live Smoke Check

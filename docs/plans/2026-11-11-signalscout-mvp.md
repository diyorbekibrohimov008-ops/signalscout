# SignalScout Implementation Plan

**Goal:** Build and maintain a 100% free full-stack web app ("SignalScout") that finds people asking for a tool like yours across Reddit, X, LinkedIn, and Hacker News.

**Architecture:** Vite + React + Tailwind SPA designed as a calm, light research reader, backed by Netlify Functions (`netlify/functions/api.mts`) or Vercel Web API (`api/index.ts`), Netlify Scheduled Functions (`cron-poll.mts` running every 10 minutes), Managed Postgres (`@netlify/database` + SQL migrations) with automatic `MemoryDb` fallback, and OpenAI / Netlify AI Gateway with a deterministic buying-intent fallback.

## Milestones
1. Core Domain & Test Suite (`src/lib/types.ts`, `intent.ts`, `reply.ts`, `notifier.ts`, `auth.ts`, `channels/*.ts`, `db.ts`, `pipeline.ts`)
2. API & Cron (`netlify/functions/api.mts`, `netlify/functions/cron-poll.mts`, `api/index.ts`)
3. Calm Research Reader Frontend (`Leads` reading desk with margin notes & reply draft, `Topics to watch`, `Notifications` with Slack/Discord & webhook bridge, `Settings` with product context & Syften comparison)
4. Verification (`vitest run`, `tsc --noEmit`, `vite build`, headless Chrome desktop + mobile visual check)

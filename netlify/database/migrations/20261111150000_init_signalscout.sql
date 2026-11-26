-- SignalScout initial PostgreSQL schema for Netlify Database
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  product_description TEXT NOT NULL DEFAULT '',
  product_url TEXT NOT NULL DEFAULT '',
  ideal_customer TEXT NOT NULL DEFAULT '',
  default_tone TEXT NOT NULL DEFAULT 'founder',
  plan TEXT NOT NULL DEFAULT 'free',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  slack_webhook_url TEXT NOT NULL DEFAULT '',
  discord_webhook_url TEXT NOT NULL DEFAULT '',
  custom_openai_key TEXT NOT NULL DEFAULT '',
  x_bearer_token TEXT NOT NULL DEFAULT '',
  apify_token TEXT NOT NULL DEFAULT '',
  ingest_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  negative_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  channels JSONB NOT NULL DEFAULT '["reddit","x","linkedin","hackernews"]'::jsonb,
  min_confidence INTEGER NOT NULL DEFAULT 70,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_handle TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  community TEXT NOT NULL DEFAULT '',
  intent_type TEXT NOT NULL,
  confidence_score INTEGER NOT NULL,
  buying_urgency TEXT NOT NULL DEFAULT 'medium',
  reasoning TEXT NOT NULL,
  pain_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_filtered_noise BOOLEAN NOT NULL DEFAULT FALSE,
  reply_hook TEXT NOT NULL DEFAULT '',
  reply_value_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  reply_soft_mention TEXT NOT NULL DEFAULT '',
  reply_draft TEXT NOT NULL DEFAULT '',
  reply_tone TEXT NOT NULL DEFAULT 'founder',
  status TEXT NOT NULL DEFAULT 'new',
  alert_sent_slack BOOLEAN NOT NULL DEFAULT FALSE,
  alert_sent_discord BOOLEAN NOT NULL DEFAULT FALSE,
  source_mode TEXT NOT NULL DEFAULT 'live',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (monitor_id, channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_workspace_created ON leads (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_noise ON leads (workspace_id, is_filtered_noise, status);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monitor_id TEXT REFERENCES monitors(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  posts_fetched INTEGER NOT NULL DEFAULT 0,
  stage1_dropped INTEGER NOT NULL DEFAULT 0,
  llm_filtered_noise INTEGER NOT NULL DEFAULT 0,
  high_intent_matched INTEGER NOT NULL DEFAULT 0,
  alerts_dispatched INTEGER NOT NULL DEFAULT 0,
  channel_statuses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

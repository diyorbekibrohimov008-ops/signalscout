// src/lib/db.ts
import { randomBytes, randomUUID } from "node:crypto";
import { getDatabase } from "@netlify/database";

// src/lib/env.ts
function getEnv(key) {
  const netlifyGlobal = globalThis.Netlify;
  const fromNetlify = netlifyGlobal?.env?.get?.(key);
  if (fromNetlify !== void 0 && fromNetlify !== "") {
    return fromNetlify;
  }
  const fromProcess = typeof process !== "undefined" ? process.env[key] : void 0;
  return fromProcess && fromProcess !== "" ? fromProcess : void 0;
}

// src/lib/db.ts
function parseJsonField(val, fallback) {
  if (val === null || val === void 0) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val;
}
function safeIsoDate(val) {
  const date = new Date(String(val ?? ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : (/* @__PURE__ */ new Date()).toISOString();
}
function mapUserRow(r) {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    passwordHash: String(r.password_hash),
    companyName: String(r.company_name ?? ""),
    createdAt: safeIsoDate(r.created_at)
  };
}
function mapWorkspaceRow(r) {
  return {
    id: String(r.id),
    ownerUserId: String(r.owner_user_id),
    name: String(r.name),
    productName: String(r.product_name ?? ""),
    productDescription: String(r.product_description ?? ""),
    productUrl: String(r.product_url ?? ""),
    idealCustomer: String(r.ideal_customer ?? ""),
    defaultTone: r.default_tone || "founder",
    plan: "free",
    trialEndsAt: safeIsoDate(r.trial_ends_at),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    slackWebhookUrl: String(r.slack_webhook_url ?? ""),
    discordWebhookUrl: String(r.discord_webhook_url ?? ""),
    customOpenaiKey: String(r.custom_openai_key ?? ""),
    xBearerToken: String(r.x_bearer_token ?? ""),
    apifyToken: String(r.apify_token ?? ""),
    ingestSecret: String(r.ingest_secret),
    createdAt: safeIsoDate(r.created_at)
  };
}
function mapMonitorRow(r) {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    name: String(r.name),
    keywords: parseJsonField(r.keywords, []),
    competitors: parseJsonField(r.competitors, []),
    negativeKeywords: parseJsonField(r.negative_keywords, []),
    channels: parseJsonField(r.channels, ["reddit", "x", "linkedin", "hackernews"]),
    minConfidence: Number(r.min_confidence ?? 70),
    isActive: Boolean(r.is_active),
    lastScannedAt: r.last_scanned_at ? safeIsoDate(r.last_scanned_at) : null,
    createdAt: safeIsoDate(r.created_at)
  };
}
function mapLeadRow(r) {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    monitorId: String(r.monitor_id),
    channel: r.channel,
    externalId: String(r.external_id),
    author: String(r.author),
    authorHandle: String(r.author_handle ?? ""),
    title: String(r.title ?? ""),
    body: String(r.body),
    url: String(r.url),
    community: String(r.community ?? ""),
    intentType: r.intent_type,
    confidenceScore: Number(r.confidence_score),
    buyingUrgency: r.buying_urgency || "medium",
    reasoning: String(r.reasoning),
    painPoints: parseJsonField(r.pain_points, []),
    isFilteredNoise: Boolean(r.is_filtered_noise),
    replyHook: String(r.reply_hook ?? ""),
    replyValuePoints: parseJsonField(r.reply_value_points, []),
    replySoftMention: String(r.reply_soft_mention ?? ""),
    replyDraft: String(r.reply_draft ?? ""),
    replyTone: r.reply_tone || "founder",
    status: r.status || "new",
    alertSentSlack: Boolean(r.alert_sent_slack),
    alertSentDiscord: Boolean(r.alert_sent_discord),
    sourceMode: r.source_mode || "live",
    publishedAt: safeIsoDate(r.published_at),
    createdAt: safeIsoDate(r.created_at)
  };
}
function mapScanRunRow(r) {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    monitorId: r.monitor_id ? String(r.monitor_id) : null,
    triggerType: r.trigger_type,
    postsFetched: Number(r.posts_fetched ?? 0),
    stage1Dropped: Number(r.stage1_dropped ?? 0),
    llmFilteredNoise: Number(r.llm_filtered_noise ?? 0),
    highIntentMatched: Number(r.high_intent_matched ?? 0),
    alertsDispatched: Number(r.alerts_dispatched ?? 0),
    channelStatuses: parseJsonField(r.channel_statuses, {}),
    createdAt: new Date(String(r.created_at)).toISOString()
  };
}
function mapBillingRow(r) {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    eventType: String(r.event_type),
    amountCents: Number(r.amount_cents ?? 0),
    description: String(r.description),
    createdAt: new Date(String(r.created_at)).toISOString()
  };
}
var singletonPgClient = null;
function getSharedPgClient() {
  if (!singletonPgClient) {
    singletonPgClient = getDatabase();
  }
  return singletonPgClient;
}
var PostgresDb = class {
  db = getSharedPgClient();
  async findUserByEmail(email) {
    const rows = await this.db.sql`SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
    return rows[0] ? mapUserRow(rows[0]) : null;
  }
  async getUserById(userId) {
    const rows = await this.db.sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
    return rows[0] ? mapUserRow(rows[0]) : null;
  }
  async getWorkspaceById(workspaceId) {
    const rows = await this.db.sql`SELECT * FROM workspaces WHERE id = ${workspaceId} LIMIT 1`;
    return rows[0] ? mapWorkspaceRow(rows[0]) : null;
  }
  async getWorkspaceByOwner(userId) {
    const rows = await this.db.sql`SELECT * FROM workspaces WHERE owner_user_id = ${userId} LIMIT 1`;
    return rows[0] ? mapWorkspaceRow(rows[0]) : null;
  }
  async getWorkspaceByIngestSecret(secret) {
    const rows = await this.db.sql`SELECT * FROM workspaces WHERE ingest_secret = ${secret} LIMIT 1`;
    return rows[0] ? mapWorkspaceRow(rows[0]) : null;
  }
  async createUserWithWorkspace(input) {
    const userId = `usr_${randomUUID().slice(0, 12)}`;
    const workspaceId = `ws_${randomUUID().slice(0, 12)}`;
    const ingestSecret = `ss_wh_${randomBytes(16).toString("hex")}`;
    const trialEndsAt = (/* @__PURE__ */ new Date()).toISOString();
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");
      const userRes = await client.query(
        `INSERT INTO users (id, email, name, password_hash, company_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, input.email.trim().toLowerCase(), input.name.trim(), input.passwordHash, input.companyName?.trim() ?? ""]
      );
      const wsRes = await client.query(
        `INSERT INTO workspaces (
           id, owner_user_id, name, product_name, product_description, product_url,
           plan, trial_ends_at, slack_webhook_url, ingest_secret
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          workspaceId,
          userId,
          input.companyName?.trim() || `${input.name.trim()}'s Workspace`,
          input.productName?.trim() ?? "",
          input.productDescription?.trim() ?? "",
          input.productUrl?.trim() ?? "",
          "free",
          trialEndsAt,
          input.slackWebhookUrl?.trim() ?? "",
          ingestSecret
        ]
      );
      await client.query("COMMIT");
      return {
        user: mapUserRow(userRes.rows[0]),
        workspace: mapWorkspaceRow(wsRes.rows[0])
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  async updateWorkspace(workspaceId, patch) {
    const existing = await this.getWorkspaceById(workspaceId);
    if (!existing) return null;
    const merged = { ...existing, ...patch };
    const rows = await this.db.sql`
      UPDATE workspaces SET
        name = ${merged.name},
        product_name = ${merged.productName},
        product_description = ${merged.productDescription},
        product_url = ${merged.productUrl},
        ideal_customer = ${merged.idealCustomer},
        default_tone = ${merged.defaultTone},
        plan = ${merged.plan},
        trial_ends_at = ${merged.trialEndsAt},
        stripe_customer_id = ${merged.stripeCustomerId},
        stripe_subscription_id = ${merged.stripeSubscriptionId},
        slack_webhook_url = ${merged.slackWebhookUrl},
        discord_webhook_url = ${merged.discordWebhookUrl},
        custom_openai_key = ${merged.customOpenaiKey},
        x_bearer_token = ${merged.xBearerToken},
        apify_token = ${merged.apifyToken}
      WHERE id = ${workspaceId}
      RETURNING *`;
    return rows[0] ? mapWorkspaceRow(rows[0]) : null;
  }
  async listMonitors(workspaceId) {
    const rows = await this.db.sql`
      SELECT * FROM monitors WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC`;
    return rows.map((r) => mapMonitorRow(r));
  }
  async listAllActiveMonitors() {
    const rows = await this.db.sql`
      SELECT m.*, w.id AS w_id, w.owner_user_id AS w_owner_user_id, w.name AS w_name,
        w.product_name AS w_product_name, w.product_description AS w_product_description,
        w.product_url AS w_product_url, w.ideal_customer AS w_ideal_customer,
        w.default_tone AS w_default_tone, w.plan AS w_plan, w.trial_ends_at AS w_trial_ends_at,
        w.stripe_customer_id AS w_stripe_customer_id, w.stripe_subscription_id AS w_stripe_subscription_id,
        w.slack_webhook_url AS w_slack_webhook_url, w.discord_webhook_url AS w_discord_webhook_url,
        w.custom_openai_key AS w_custom_openai_key, w.x_bearer_token AS w_x_bearer_token,
        w.apify_token AS w_apify_token, w.ingest_secret AS w_ingest_secret, w.created_at AS w_created_at
      FROM monitors m
      JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.is_active = TRUE
      ORDER BY m.last_scanned_at ASC NULLS FIRST
      LIMIT 25`;
    return rows.map((row) => {
      const r = row;
      return {
        monitor: mapMonitorRow(r),
        workspace: mapWorkspaceRow({
          id: r.w_id,
          owner_user_id: r.w_owner_user_id,
          name: r.w_name,
          product_name: r.w_product_name,
          product_description: r.w_product_description,
          product_url: r.w_product_url,
          ideal_customer: r.w_ideal_customer,
          default_tone: r.w_default_tone,
          plan: r.w_plan,
          trial_ends_at: r.w_trial_ends_at,
          stripe_customer_id: r.w_stripe_customer_id,
          stripe_subscription_id: r.w_stripe_subscription_id,
          slack_webhook_url: r.w_slack_webhook_url,
          discord_webhook_url: r.w_discord_webhook_url,
          custom_openai_key: r.w_custom_openai_key,
          x_bearer_token: r.w_x_bearer_token,
          apify_token: r.w_apify_token,
          ingest_secret: r.w_ingest_secret,
          created_at: r.w_created_at
        })
      };
    });
  }
  async getMonitor(workspaceId, monitorId) {
    const rows = await this.db.sql`
      SELECT * FROM monitors WHERE id = ${monitorId} AND workspace_id = ${workspaceId} LIMIT 1`;
    return rows[0] ? mapMonitorRow(rows[0]) : null;
  }
  async createMonitor(input) {
    const id = `mon_${randomUUID().slice(0, 12)}`;
    const rows = await this.db.sql`
      INSERT INTO monitors (id, workspace_id, name, keywords, competitors, negative_keywords, channels, min_confidence)
      VALUES (
        ${id},
        ${input.workspaceId},
        ${input.name.trim()},
        ${JSON.stringify(input.keywords)}::jsonb,
        ${JSON.stringify(input.competitors)}::jsonb,
        ${JSON.stringify(input.negativeKeywords)}::jsonb,
        ${JSON.stringify(input.channels)}::jsonb,
        ${input.minConfidence}
      )
      RETURNING *`;
    return mapMonitorRow(rows[0]);
  }
  async updateMonitor(workspaceId, monitorId, patch) {
    const existing = await this.getMonitor(workspaceId, monitorId);
    if (!existing) return null;
    const merged = { ...existing, ...patch };
    const rows = await this.db.sql`
      UPDATE monitors SET
        name = ${merged.name},
        keywords = ${JSON.stringify(merged.keywords)}::jsonb,
        competitors = ${JSON.stringify(merged.competitors)}::jsonb,
        negative_keywords = ${JSON.stringify(merged.negativeKeywords)}::jsonb,
        channels = ${JSON.stringify(merged.channels)}::jsonb,
        min_confidence = ${merged.minConfidence},
        is_active = ${merged.isActive},
        last_scanned_at = ${merged.lastScannedAt}
      WHERE id = ${monitorId} AND workspace_id = ${workspaceId}
      RETURNING *`;
    return rows[0] ? mapMonitorRow(rows[0]) : null;
  }
  async deleteMonitor(workspaceId, monitorId) {
    const rows = await this.db.sql`
      DELETE FROM monitors WHERE id = ${monitorId} AND workspace_id = ${workspaceId} RETURNING id`;
    return rows.length > 0;
  }
  async hasLeadExternalId(monitorId, channel, externalId) {
    const rows = await this.db.sql`
      SELECT 1 FROM leads WHERE monitor_id = ${monitorId} AND channel = ${channel} AND external_id = ${externalId} LIMIT 1`;
    return rows.length > 0;
  }
  async insertLead(input) {
    const id = `lead_${randomUUID().slice(0, 12)}`;
    const rows = await this.db.sql`
      INSERT INTO leads (
        id, workspace_id, monitor_id, channel, external_id, author, author_handle,
        title, body, url, community, intent_type, confidence_score, buying_urgency,
        reasoning, pain_points, is_filtered_noise, reply_hook, reply_value_points,
        reply_soft_mention, reply_draft, reply_tone, status, alert_sent_slack,
        alert_sent_discord, source_mode, published_at
      )
      VALUES (
        ${id}, ${input.workspaceId}, ${input.monitorId}, ${input.channel}, ${input.externalId},
        ${input.author}, ${input.authorHandle}, ${input.title}, ${input.body}, ${input.url},
        ${input.community}, ${input.intentType}, ${input.confidenceScore}, ${input.buyingUrgency},
        ${input.reasoning}, ${JSON.stringify(input.painPoints)}::jsonb, ${input.isFilteredNoise},
        ${input.replyHook}, ${JSON.stringify(input.replyValuePoints)}::jsonb,
        ${input.replySoftMention}, ${input.replyDraft}, ${input.replyTone}, ${input.status},
        ${input.alertSentSlack}, ${input.alertSentDiscord}, ${input.sourceMode}, ${input.publishedAt}
      )
      ON CONFLICT (monitor_id, channel, external_id) DO NOTHING
      RETURNING *`;
    return rows[0] ? mapLeadRow(rows[0]) : null;
  }
  async listLeads(workspaceId, opts = {}) {
    const limit = opts.limit ?? 100;
    const rows = await this.db.sql`
      SELECT * FROM leads WHERE workspace_id = ${workspaceId} ORDER BY published_at DESC, created_at DESC LIMIT 300`;
    let items = rows.map((r) => mapLeadRow(r));
    if (opts.onlyNoise) {
      items = items.filter((l) => l.isFilteredNoise);
    } else if (!opts.includeNoise) {
      items = items.filter((l) => !l.isFilteredNoise);
    }
    if (opts.channel && opts.channel !== "all") {
      items = items.filter((l) => l.channel === opts.channel);
    }
    if (opts.status && opts.status !== "all") {
      items = items.filter((l) => l.status === opts.status);
    }
    return items.slice(0, limit);
  }
  async getLead(workspaceId, leadId) {
    const rows = await this.db.sql`
      SELECT * FROM leads WHERE id = ${leadId} AND workspace_id = ${workspaceId} LIMIT 1`;
    return rows[0] ? mapLeadRow(rows[0]) : null;
  }
  async updateLead(workspaceId, leadId, patch) {
    const existing = await this.getLead(workspaceId, leadId);
    if (!existing) return null;
    const merged = { ...existing, ...patch };
    const rows = await this.db.sql`
      UPDATE leads SET
        status = ${merged.status},
        reply_hook = ${merged.replyHook},
        reply_value_points = ${JSON.stringify(merged.replyValuePoints)}::jsonb,
        reply_soft_mention = ${merged.replySoftMention},
        reply_draft = ${merged.replyDraft},
        reply_tone = ${merged.replyTone},
        alert_sent_slack = ${merged.alertSentSlack},
        alert_sent_discord = ${merged.alertSentDiscord}
      WHERE id = ${leadId} AND workspace_id = ${workspaceId}
      RETURNING *`;
    return rows[0] ? mapLeadRow(rows[0]) : null;
  }
  async insertScanRun(input) {
    const id = `run_${randomUUID().slice(0, 12)}`;
    const rows = await this.db.sql`
      INSERT INTO scan_runs (
        id, workspace_id, monitor_id, trigger_type, posts_fetched,
        stage1_dropped, llm_filtered_noise, high_intent_matched, alerts_dispatched, channel_statuses
      )
      VALUES (
        ${id}, ${input.workspaceId}, ${input.monitorId}, ${input.triggerType}, ${input.postsFetched},
        ${input.stage1Dropped}, ${input.llmFilteredNoise}, ${input.highIntentMatched},
        ${input.alertsDispatched}, ${JSON.stringify(input.channelStatuses)}::jsonb
      )
      RETURNING *`;
    return mapScanRunRow(rows[0]);
  }
  async listScanRuns(workspaceId, limit = 20) {
    const rows = await this.db.sql`
      SELECT * FROM scan_runs WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map((r) => mapScanRunRow(r));
  }
  async insertBillingEvent(input) {
    const id = `bil_${randomUUID().slice(0, 12)}`;
    const rows = await this.db.sql`
      INSERT INTO billing_events (id, workspace_id, event_type, amount_cents, description)
      VALUES (${id}, ${input.workspaceId}, ${input.eventType}, ${input.amountCents}, ${input.description})
      RETURNING *`;
    return mapBillingRow(rows[0]);
  }
  async listBillingEvents(workspaceId) {
    const rows = await this.db.sql`
      SELECT * FROM billing_events WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT 30`;
    return rows.map((r) => mapBillingRow(r));
  }
  async getWorkspaceStats(workspaceId) {
    const leads = await this.listLeads(workspaceId, { includeNoise: true, limit: 300 });
    const monitors = await this.listMonitors(workspaceId);
    const runs = await this.listScanRuns(workspaceId, 50);
    const highIntent = leads.filter((l) => !l.isFilteredNoise);
    const noiseBlocked = leads.filter((l) => l.isFilteredNoise).length + runs.reduce((sum, r) => sum + r.stage1Dropped, 0);
    const avgConfidence = highIntent.length > 0 ? Math.round(highIntent.reduce((sum, l) => sum + l.confidenceScore, 0) / highIntent.length) : 0;
    return {
      totalLeads: highIntent.length,
      newLeads: highIntent.filter((l) => l.status === "new").length,
      repliedLeads: highIntent.filter((l) => l.status === "replied").length,
      noiseBlocked,
      alertsSent: highIntent.filter((l) => l.alertSentSlack || l.alertSentDiscord).length,
      activeMonitors: monitors.filter((m) => m.isActive).length,
      avgConfidence
    };
  }
};
var MemoryDb = class {
  users = /* @__PURE__ */ new Map();
  workspaces = /* @__PURE__ */ new Map();
  monitors = /* @__PURE__ */ new Map();
  leads = /* @__PURE__ */ new Map();
  scanRuns = [];
  billingEvents = [];
  async findUserByEmail(email) {
    const target = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === target) return user;
    }
    return null;
  }
  async getUserById(userId) {
    return this.users.get(userId) ?? null;
  }
  async getWorkspaceById(workspaceId) {
    return this.workspaces.get(workspaceId) ?? null;
  }
  async getWorkspaceByOwner(userId) {
    for (const ws of this.workspaces.values()) {
      if (ws.ownerUserId === userId) return ws;
    }
    return null;
  }
  async getWorkspaceByIngestSecret(secret) {
    for (const ws of this.workspaces.values()) {
      if (ws.ingestSecret === secret) return ws;
    }
    return null;
  }
  async createUserWithWorkspace(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const user = {
      id: `usr_${randomUUID().slice(0, 12)}`,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      companyName: input.companyName?.trim() ?? "",
      createdAt: now
    };
    const workspace = {
      id: `ws_${randomUUID().slice(0, 12)}`,
      ownerUserId: user.id,
      name: input.companyName?.trim() || `${user.name}'s Workspace`,
      productName: input.productName?.trim() ?? "",
      productDescription: input.productDescription?.trim() ?? "",
      productUrl: input.productUrl?.trim() ?? "",
      idealCustomer: "",
      defaultTone: "founder",
      plan: "free",
      trialEndsAt: now,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      slackWebhookUrl: input.slackWebhookUrl?.trim() ?? "",
      discordWebhookUrl: "",
      customOpenaiKey: "",
      xBearerToken: "",
      apifyToken: "",
      ingestSecret: `ss_wh_${randomBytes(16).toString("hex")}`,
      createdAt: now
    };
    this.users.set(user.id, user);
    this.workspaces.set(workspace.id, workspace);
    return { user, workspace };
  }
  async updateWorkspace(workspaceId, patch) {
    const existing = this.workspaces.get(workspaceId);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.workspaces.set(workspaceId, updated);
    return updated;
  }
  async listMonitors(workspaceId) {
    return Array.from(this.monitors.values()).filter((m) => m.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listAllActiveMonitors() {
    const out = [];
    for (const m of this.monitors.values()) {
      if (!m.isActive) continue;
      const ws = this.workspaces.get(m.workspaceId);
      if (ws) {
        out.push({ monitor: m, workspace: ws });
      }
    }
    return out;
  }
  async getMonitor(workspaceId, monitorId) {
    const m = this.monitors.get(monitorId);
    return m && m.workspaceId === workspaceId ? m : null;
  }
  async createMonitor(input) {
    const monitor = {
      id: `mon_${randomUUID().slice(0, 12)}`,
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      keywords: input.keywords,
      competitors: input.competitors,
      negativeKeywords: input.negativeKeywords,
      channels: input.channels,
      minConfidence: input.minConfidence,
      isActive: true,
      lastScannedAt: null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.monitors.set(monitor.id, monitor);
    return monitor;
  }
  async updateMonitor(workspaceId, monitorId, patch) {
    const existing = await this.getMonitor(workspaceId, monitorId);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.monitors.set(monitorId, updated);
    return updated;
  }
  async deleteMonitor(workspaceId, monitorId) {
    const existing = await this.getMonitor(workspaceId, monitorId);
    if (!existing) return false;
    return this.monitors.delete(monitorId);
  }
  async hasLeadExternalId(monitorId, channel, externalId) {
    for (const l of this.leads.values()) {
      if (l.monitorId === monitorId && l.channel === channel && l.externalId === externalId) return true;
    }
    return false;
  }
  async insertLead(input) {
    if (await this.hasLeadExternalId(input.monitorId, input.channel, input.externalId)) {
      return null;
    }
    const lead = {
      id: `lead_${randomUUID().slice(0, 12)}`,
      ...input,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.leads.set(lead.id, lead);
    return lead;
  }
  async listLeads(workspaceId, opts = {}) {
    let items = Array.from(this.leads.values()).filter((l) => l.workspaceId === workspaceId).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.createdAt.localeCompare(a.createdAt));
    if (opts.onlyNoise) {
      items = items.filter((l) => l.isFilteredNoise);
    } else if (!opts.includeNoise) {
      items = items.filter((l) => !l.isFilteredNoise);
    }
    if (opts.channel && opts.channel !== "all") {
      items = items.filter((l) => l.channel === opts.channel);
    }
    if (opts.status && opts.status !== "all") {
      items = items.filter((l) => l.status === opts.status);
    }
    return items.slice(0, opts.limit ?? 100);
  }
  async getLead(workspaceId, leadId) {
    const l = this.leads.get(leadId);
    return l && l.workspaceId === workspaceId ? l : null;
  }
  async updateLead(workspaceId, leadId, patch) {
    const existing = await this.getLead(workspaceId, leadId);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.leads.set(leadId, updated);
    return updated;
  }
  async insertScanRun(input) {
    const run = {
      id: `run_${randomUUID().slice(0, 12)}`,
      ...input,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.scanRuns.unshift(run);
    return run;
  }
  async listScanRuns(workspaceId, limit = 20) {
    return this.scanRuns.filter((r) => r.workspaceId === workspaceId).slice(0, limit);
  }
  async insertBillingEvent(input) {
    const ev = {
      id: `bil_${randomUUID().slice(0, 12)}`,
      ...input,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.billingEvents.unshift(ev);
    return ev;
  }
  async listBillingEvents(workspaceId) {
    return this.billingEvents.filter((b) => b.workspaceId === workspaceId);
  }
  async getWorkspaceStats(workspaceId) {
    const leads = await this.listLeads(workspaceId, { includeNoise: true, limit: 300 });
    const monitors = await this.listMonitors(workspaceId);
    const runs = await this.listScanRuns(workspaceId, 50);
    const highIntent = leads.filter((l) => !l.isFilteredNoise);
    const noiseBlocked = leads.filter((l) => l.isFilteredNoise).length + runs.reduce((sum, r) => sum + r.stage1Dropped, 0);
    const avgConfidence = highIntent.length > 0 ? Math.round(highIntent.reduce((sum, l) => sum + l.confidenceScore, 0) / highIntent.length) : 0;
    return {
      totalLeads: highIntent.length,
      newLeads: highIntent.filter((l) => l.status === "new").length,
      repliedLeads: highIntent.filter((l) => l.status === "replied").length,
      noiseBlocked,
      alertsSent: highIntent.filter((l) => l.alertSentSlack || l.alertSentDiscord).length,
      activeMonitors: monitors.filter((m) => m.isActive).length,
      avgConfidence
    };
  }
};
var cachedMemoryDb = null;
var cachedPostgresDb = null;
function getDb() {
  const hasNetlifyDb = Boolean(getEnv("NETLIFY_DB_URL") || getEnv("DATABASE_URL"));
  if (hasNetlifyDb) {
    if (!cachedPostgresDb) {
      cachedPostgresDb = new PostgresDb();
    }
    return cachedPostgresDb;
  }
  if (!cachedMemoryDb) {
    cachedMemoryDb = new MemoryDb();
  }
  return cachedMemoryDb;
}

// src/lib/auth.ts
import { createHash, createHmac, pbkdf2Sync, randomBytes as randomBytes2, timingSafeEqual } from "node:crypto";
var SESSION_COOKIE_NAME = "ss_session";
async function hashPassword(password) {
  const salt = randomBytes2(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, 1e5, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${salt}$${derived}`;
}
async function verifyPassword(password, storedHash) {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derived = pbkdf2Sync(password, salt, 1e5, 32, "sha256");
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
function toBase64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
  return Buffer.from(padded, "base64");
}
var DETERMINISTIC_FALLBACK_SECRET = createHash("sha256").update(
  `signalscout-session::${getEnv("VERCEL_PROJECT_ID") || getEnv("SITE_ID") || "local-dev-workspace"}`
).digest("hex");
function getSessionSecret() {
  return getEnv("SESSION_SECRET") || DETERMINISTIC_FALLBACK_SECRET;
}
async function signSessionToken(claims, secret = getSessionSecret(), ttlSeconds = 60 * 60 * 24 * 7) {
  const payload = {
    ...claims,
    exp: Math.floor(Date.now() / 1e3) + ttlSeconds
  };
  const body = toBase64Url(JSON.stringify(payload));
  const sig = toBase64Url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}
async function verifySessionToken(token, secret = getSessionSecret()) {
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const body = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!body || !sig) return null;
  const expectedSig = createHmac("sha256", secret).update(body).digest();
  const actualSig = fromBase64Url(sig);
  if (actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fromBase64Url(body).toString("utf8"));
    if (!parsed.userId || !parsed.workspaceId || !parsed.exp) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1e3)) return null;
    return parsed;
  } catch {
    return null;
  }
}
function parseCookieHeader(header) {
  if (!header) return {};
  const out = {};
  for (const segment of header.split(";")) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim();
    const val = segment.slice(eq + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}
function buildSessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const secureFlag = getEnv("CONTEXT") === "production" || getEnv("NODE_ENV") === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secureFlag}`;
}
function buildClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

// src/lib/billing.ts
var FREE_PLAN_PRICE_CENTS = 0;
function getFreePlanStatus() {
  return {
    plan: "free",
    priceMonthlyCents: FREE_PLAN_PRICE_CENTS,
    allFeaturesUnlocked: true,
    message: "SignalScout is 100% free with all channels, filters, and reply drafts unlocked."
  };
}

// src/lib/intent.ts
import OpenAI from "openai";
var SPAM_PATTERNS = [
  /\bpromo\s*code\b/i,
  /\bdiscount\s*code\b/i,
  /\baffiliate\b/i,
  /\buse\s+my\s+referral\b/i,
  /\bdm\s+me\s+for\s+cheap\b/i,
  /\bclick\s+here\b/i,
  /\bwe\s+are\s+hiring\b/i,
  /\bjob\s+opening\b/i
];
var LISTICLE_SPAM_PATTERNS = [
  /\btop\s+\d+\s+.*tools\b/i,
  /\bbest\s+\d+\s+.*tools\b/i,
  /\baffiliate\b/i,
  /\bpromo\s*code\b/i,
  /\bsponsored\b/i,
  /\bcheck\s+out\s+my\s+(blog|newsletter|youtube)\b/i,
  /\bjust\s+published\s+(a\s+)?(blog|article|guide)\b/i
];
var COMPETITOR_COMPLAINT_SIGNALS = [
  "expensive",
  "overpriced",
  "add-on",
  "add on",
  "extra for",
  "charge",
  "charging",
  "flooding",
  "spam",
  "noise",
  "noisy",
  "false positive",
  "false positives",
  "irrelevant",
  "sick of",
  "tired of",
  "annoying",
  "hate",
  "sucks",
  "broken",
  "ridiculous",
  "wild",
  "bumped our bill",
  "moved off",
  "switching off",
  "cancel",
  "canceling",
  "cancelling"
];
var EXPLICIT_BUYING_SIGNALS = [
  "budget",
  "ready to switch",
  "ready to buy",
  "evaluating",
  "this week",
  "asap",
  "looking to buy",
  "willing to pay",
  "need a tool",
  "purchasing",
  "procurement",
  "switch today",
  "trialing"
];
var RECOMMENDATION_SIGNALS = [
  "alternative to",
  "alternatives",
  "looking for",
  "any recommendations",
  "recommendations for",
  "recommend",
  "what do you use",
  "what are you using",
  "anyone moved off",
  "anyone know",
  "suggestions for",
  "best tool for",
  "switched from",
  "replace ",
  "replacing "
];
function runStage1Filter(post, monitor) {
  const haystack = `${post.title}
${post.body}`.toLowerCase();
  for (const neg of monitor.negativeKeywords) {
    const trimmed = neg.trim().toLowerCase();
    if (trimmed && haystack.includes(trimmed)) {
      return {
        passed: false,
        reason: `Matched negative keyword "${neg}"`,
        matchedTerms: []
      };
    }
  }
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(haystack)) {
      return {
        passed: false,
        reason: "Dropped obvious promotional or hiring pattern before LLM evaluation",
        matchedTerms: []
      };
    }
  }
  const terms = [...monitor.keywords, ...monitor.competitors].map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) {
    return {
      passed: true,
      reason: "No keyword restriction configured",
      matchedTerms: []
    };
  }
  const matchedTerms = terms.filter((term) => haystack.includes(term));
  if (matchedTerms.length === 0) {
    return {
      passed: false,
      reason: "No keyword or competitor match in post content",
      matchedTerms: []
    };
  }
  return {
    passed: true,
    reason: `Matched ${matchedTerms.join(", ")}`,
    matchedTerms
  };
}
function extractPainPoints(text) {
  const lower = text.toLowerCase();
  const points = [];
  if (/(add-on|add on|extra|expensive|overpriced|price|pricing|bill|\$\d+)/i.test(lower)) {
    points.push("channel add-on pricing");
  }
  if (/(noise|noisy|spam|irrelevant|false positive|flood)/i.test(lower)) {
    points.push("noisy keyword alerts");
  }
  if (/(reply|outreach|draft|shill|manual)/i.test(lower)) {
    points.push("manual outreach burden");
  }
  if (/(twitter|x |linkedin|reddit|hacker news|hn|channel)/i.test(lower)) {
    points.push("multi-channel monitoring");
  }
  if (/(slow|delay|missed|late|real-time|realtime)/i.test(lower)) {
    points.push("alert speed & coverage");
  }
  if (points.length === 0) {
    points.push("evaluating social listening workflow");
  }
  return points;
}
function classifyIntentHeuristic(post, monitor) {
  const combined = `${post.title} ${post.body}`.trim();
  const lower = combined.toLowerCase();
  if (LISTICLE_SPAM_PATTERNS.some((re) => re.test(lower))) {
    return {
      intentType: "noise_or_irrelevant",
      confidenceScore: 22,
      buyingUrgency: "low",
      reasoning: "Looks like promotional content, a listicle, or affiliate link drop rather than a buyer.",
      painPoints: []
    };
  }
  const hasNegative = monitor.negativeKeywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase()));
  if (hasNegative) {
    return {
      intentType: "noise_or_irrelevant",
      confidenceScore: 15,
      buyingUrgency: "low",
      reasoning: "Contains excluded negative keyword.",
      painPoints: []
    };
  }
  const competitorList = [...monitor.competitors.map((c) => c.toLowerCase()), "syften", "octolens", "f5bot", "brand24"];
  const mentionsCompetitor = competitorList.some((c) => c && lower.includes(c));
  const complaintHits = COMPETITOR_COMPLAINT_SIGNALS.filter((s) => lower.includes(s)).length;
  const buyingHits = EXPLICIT_BUYING_SIGNALS.filter((s) => lower.includes(s)).length;
  const recHits = RECOMMENDATION_SIGNALS.filter((s) => lower.includes(s)).length + (combined.includes("?") ? 1 : 0);
  const painPoints = extractPainPoints(combined);
  let intentType = "noise_or_irrelevant";
  let confidenceScore = 40;
  let buyingUrgency = "low";
  let reasoning = "Mentions tracked terms without clear buying or switching intent.";
  if (buyingHits >= 2 || buyingHits >= 1 && (recHits >= 1 || mentionsCompetitor)) {
    intentType = "explicit_buying_intent";
    confidenceScore = Math.min(97, 78 + buyingHits * 6 + (mentionsCompetitor ? 5 : 0));
    buyingUrgency = "high";
    reasoning = "Author expresses active evaluation, budget, or immediate readiness to purchase/switch.";
  } else if (mentionsCompetitor && complaintHits >= 1) {
    intentType = "competitor_complaint";
    confidenceScore = Math.min(96, 77 + complaintHits * 6 + (recHits >= 1 ? 5 : 0));
    buyingUrgency = complaintHits >= 2 || recHits >= 1 ? "high" : "medium";
    reasoning = "Author expresses frustration with an incumbent monitoring tool's pricing, noise, or workflow.";
  } else if (recHits >= 2 || recHits >= 1 && (mentionsCompetitor || painPoints.length >= 1)) {
    intentType = "recommendation_request";
    confidenceScore = Math.min(93, 72 + recHits * 6 + (mentionsCompetitor ? 6 : 0));
    buyingUrgency = mentionsCompetitor || buyingHits > 0 ? "high" : "medium";
    reasoning = "Author is actively asking peers for product recommendations or alternatives.";
  } else if (buyingHits === 1) {
    intentType = "explicit_buying_intent";
    confidenceScore = 76;
    buyingUrgency = "medium";
    reasoning = "Author indicates active tool evaluation or near-term buying intent.";
  } else if (combined.includes("?") && (lower.includes("tool") || lower.includes("software") || lower.includes("monitor"))) {
    intentType = "recommendation_request";
    confidenceScore = 71;
    buyingUrgency = "medium";
    reasoning = "Author asks a tool-selection question related to tracked keywords.";
  }
  return {
    intentType,
    confidenceScore,
    buyingUrgency,
    reasoning,
    painPoints
  };
}
async function callOpenAiIntentClassifier(post, monitor, workspace) {
  const customKey = workspace.customOpenaiKey.trim();
  const envKey = getEnv("OPENAI_API_KEY");
  const gatewayUrl = getEnv("OPENAI_BASE_URL");
  if (!customKey && !envKey && !gatewayUrl) {
    return null;
  }
  const client = customKey ? new OpenAI({ apiKey: customKey }) : new OpenAI();
  const model = getEnv("SIGNALSCOUT_LLM_MODEL") || "gpt-4o-mini";
  const prompt = [
    `Classify whether this social post shows genuine B2B/SaaS buying intent for "${workspace.productName || monitor.name}".`,
    `Product context: ${workspace.productDescription || "Social media buying-intent monitoring tool"}`,
    `Tracked keywords: ${monitor.keywords.join(", ")}`,
    `Tracked competitors: ${monitor.competitors.join(", ")}`,
    ``,
    `Channel: ${post.channel} (${post.community})`,
    `Title: ${post.title}`,
    `Body: ${post.body.slice(0, 1200)}`,
    ``,
    `Return strict JSON with keys:`,
    `- intentType: "recommendation_request" | "competitor_complaint" | "explicit_buying_intent" | "noise_or_irrelevant"`,
    `- confidenceScore: integer 0..100`,
    `- buyingUrgency: "high" | "medium" | "low"`,
    `- reasoning: 1 concise sentence explaining why`,
    `- painPoints: array of 1-3 short strings`
  ].join("\n");
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a precision buying-intent classifier. Reject SEO listicles, promo spam, hiring posts, and casual chatter as noise_or_irrelevant."
      },
      { role: "user", content: prompt }
    ]
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const validTypes = [
    "recommendation_request",
    "competitor_complaint",
    "explicit_buying_intent",
    "noise_or_irrelevant"
  ];
  const intentType = validTypes.includes(parsed.intentType) ? parsed.intentType : "noise_or_irrelevant";
  const confidenceScore = Math.max(0, Math.min(100, Math.round(Number(parsed.confidenceScore ?? 50))));
  const buyingUrgency = parsed.buyingUrgency === "high" || parsed.buyingUrgency === "low" ? parsed.buyingUrgency : "medium";
  return {
    intentType,
    confidenceScore,
    buyingUrgency,
    reasoning: typeof parsed.reasoning === "string" && parsed.reasoning ? parsed.reasoning : "Classified by LLM intent filter.",
    painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints.filter((p) => typeof p === "string").slice(0, 4) : []
  };
}
async function classifyIntent(post, monitor, workspace, options = {}) {
  if (options.llmEvaluate) {
    try {
      const llm = await options.llmEvaluate(post, monitor, workspace);
      return {
        ...llm,
        shouldAlert: llm.intentType !== "noise_or_irrelevant" && llm.confidenceScore >= monitor.minConfidence,
        classifierMode: "llm"
      };
    } catch {
    }
  } else {
    try {
      const llm = await callOpenAiIntentClassifier(post, monitor, workspace);
      if (llm) {
        return {
          ...llm,
          shouldAlert: llm.intentType !== "noise_or_irrelevant" && llm.confidenceScore >= monitor.minConfidence,
          classifierMode: "llm"
        };
      }
    } catch {
    }
  }
  const heuristic = classifyIntentHeuristic(post, monitor);
  return {
    ...heuristic,
    shouldAlert: heuristic.intentType !== "noise_or_irrelevant" && heuristic.confidenceScore >= monitor.minConfidence,
    classifierMode: "heuristic"
  };
}

// src/lib/notifier.ts
var INTENT_LABELS = {
  recommendation_request: "Recommendation Request",
  competitor_complaint: "Competitor Complaint",
  explicit_buying_intent: "Explicit Buying Intent",
  noise_or_irrelevant: "Filtered Noise"
};
var CHANNEL_LABELS = {
  reddit: "Reddit",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  hackernews: "Hacker News"
};
function buildSlackPayload(lead, monitor) {
  const channelLabel = CHANNEL_LABELS[lead.channel];
  const intentLabel = INTENT_LABELS[lead.intentType];
  const headerText = `${channelLabel} \u2022 ${intentLabel} (${lead.confidenceScore}/100)`;
  const headline = lead.title ? `*${lead.title}*
` : "";
  const excerpt = lead.body.length > 360 ? `${lead.body.slice(0, 357)}...` : lead.body;
  return {
    text: `[SignalScout] ${headerText}: ${lead.title || lead.body.slice(0, 90)}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: headerText
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Monitor:*
${monitor.name}` },
          { type: "mrkdwn", text: `*Source:*
${lead.community || channelLabel} (${lead.authorHandle || lead.author})` },
          { type: "mrkdwn", text: `*Urgency:*
${lead.buyingUrgency.toUpperCase()}` },
          { type: "mrkdwn", text: `*Confidence:*
${lead.confidenceScore}/100` }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${headline}> ${excerpt.replace(/\n+/g, "\n> ")}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Why this passed LLM filter:* ${lead.reasoning}`
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Contextual Reply Outline (${lead.replyTone} tone \u2014 edit & post in seconds):*
\`\`\`${lead.replyDraft}\`\`\``
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Thread"
            },
            url: lead.url,
            style: "primary"
          }
        ]
      }
    ]
  };
}
function buildDiscordPayload(lead, monitor) {
  const channelLabel = CHANNEL_LABELS[lead.channel];
  const intentLabel = INTENT_LABELS[lead.intentType];
  const color = lead.buyingUrgency === "high" ? 1096065 : 16096779;
  const excerpt = lead.body.length > 400 ? `${lead.body.slice(0, 397)}...` : lead.body;
  return {
    content: `**SignalScout Buying Signal** \u2014 ${channelLabel} (${lead.confidenceScore}/100)`,
    embeds: [
      {
        title: lead.title || `${channelLabel} post by ${lead.authorHandle || lead.author}`,
        url: lead.url,
        description: excerpt,
        color,
        fields: [
          { name: "Monitor", value: monitor.name, inline: true },
          { name: "Intent", value: `${intentLabel} (${lead.confidenceScore}/100)`, inline: true },
          { name: "Urgency", value: lead.buyingUrgency.toUpperCase(), inline: true },
          { name: "Why Matched", value: lead.reasoning, inline: false },
          {
            name: `Contextual Reply Outline (${lead.replyTone})`,
            value: `Hook: ${lead.replyHook}

${lead.replyDraft.slice(0, 900)}`,
            inline: false
          }
        ],
        footer: { text: `SignalScout \u2022 ${lead.community || channelLabel}` }
      }
    ]
  };
}
function isSafeWebhookEndpoint(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host.includes(":")) {
      return false;
    }
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const p = ipv4.slice(1).map(Number);
      if (p.some((n) => n > 255) || p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] === 169 && p[1] === 254 || p[0] === 172 && p[1] >= 16 && p[1] <= 31 || p[0] === 192 && p[1] === 168 || p[0] === 100 && p[1] >= 64 && p[1] <= 127) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
async function dispatchWebhookAlerts(lead, monitor, workspace, fetchFn = fetch) {
  let slackSent = false;
  let discordSent = false;
  const errors = [];
  const slackUrl = workspace.slackWebhookUrl.trim();
  if (slackUrl) {
    if (fetchFn === fetch && !isSafeWebhookEndpoint(slackUrl)) {
      errors.push("Slack webhook blocked: URL must be a public https:// endpoint.");
    } else {
      try {
        const res = await fetchFn(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSlackPayload(lead, monitor)),
          signal: AbortSignal.timeout(6e3)
        });
        if (res.ok) {
          slackSent = true;
        } else {
          errors.push(`Slack webhook returned HTTP ${res.status}`);
        }
      } catch (err) {
        errors.push(`Slack webhook failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  const discordUrl = workspace.discordWebhookUrl.trim();
  if (discordUrl) {
    if (fetchFn === fetch && !isSafeWebhookEndpoint(discordUrl)) {
      errors.push("Discord webhook blocked: URL must be a public https:// endpoint.");
    } else {
      try {
        const res = await fetchFn(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildDiscordPayload(lead, monitor)),
          signal: AbortSignal.timeout(6e3)
        });
        if (res.ok) {
          discordSent = true;
        } else {
          errors.push(`Discord webhook returned HTTP ${res.status}`);
        }
      } catch (err) {
        errors.push(`Discord webhook failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return { slackSent, discordSent, errors };
}

// src/lib/channels/hn.ts
function stripHtml(raw) {
  return raw.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}
async function fetchHackerNewsPosts(terms, fetchFn = fetch) {
  const uniqueTerms = terms.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (uniqueTerms.length === 0) {
    return {
      posts: [],
      status: { channel: "hackernews", status: "live", fetched: 0, note: "No search terms configured" }
    };
  }
  const seen = /* @__PURE__ */ new Set();
  const posts = [];
  try {
    for (const term of uniqueTerms) {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=(story,comment)&hitsPerPage=15`;
      const res = await fetchFn(url, { signal: AbortSignal.timeout(6e3) });
      if (!res.ok) {
        return {
          posts,
          status: {
            channel: "hackernews",
            status: res.status === 429 ? "rate_limited" : "error",
            fetched: posts.length,
            note: `HN Algolia HTTP ${res.status}`
          }
        };
      }
      const data = await res.json();
      for (const hit of data.hits ?? []) {
        const id = hit.objectID;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const isAskHn = hit._tags?.includes("ask_hn");
        const title = hit.title || hit.story_title || "";
        const body = stripHtml(hit.comment_text || hit.story_text || title);
        if (!body && !title) continue;
        posts.push({
          channel: "hackernews",
          externalId: id,
          author: hit.author || "hn_user",
          authorHandle: hit.author || "hn_user",
          title,
          body,
          url: `https://news.ycombinator.com/item?id=${id}`,
          community: isAskHn ? "Ask HN" : "Hacker News",
          publishedAt: hit.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          sourceMode: "live"
        });
      }
    }
    return {
      posts,
      status: {
        channel: "hackernews",
        status: "live",
        fetched: posts.length,
        note: `Live Algolia HN API (${posts.length} hits)`
      }
    };
  } catch (err) {
    return {
      posts,
      status: {
        channel: "hackernews",
        status: "error",
        fetched: posts.length,
        note: err instanceof Error ? err.message : "HN fetch error"
      }
    };
  }
}

// src/lib/channels/linkedin.ts
function buildSimulatedLinkedInPosts(terms) {
  const anchor = terms[0] || "social listening";
  const now = Date.now();
  return [
    {
      channel: "linkedin",
      externalId: `sim_li_${Buffer.from(anchor).toString("hex").slice(0, 8)}_1`,
      author: "Daniel Rivera",
      authorHandle: "Daniel Rivera \u2022 VP Growth",
      title: "",
      body: `We have Q4 budget approved to switch our ${anchor} stack this week. Octolens is giving us way too many false positives in Slack \u2014 what are other B2B teams using?`,
      url: "https://www.linkedin.com/feed/update/urn:li:activity:7261001928374",
      community: "LinkedIn Feed",
      publishedAt: new Date(now - 1e3 * 60 * 25).toISOString(),
      sourceMode: "simulation"
    }
  ];
}
async function fetchLinkedInPosts(terms, options = {}) {
  const queryTerms = terms.map((t) => t.trim()).filter(Boolean);
  if (options.includeSimulation) {
    const posts = buildSimulatedLinkedInPosts(queryTerms);
    return {
      posts,
      status: {
        channel: "linkedin",
        status: "simulated",
        fetched: posts.length,
        note: "Simulated LinkedIn feed (push live posts via Webhook Bridge / Zapier / Apify)"
      }
    };
  }
  return {
    posts: [],
    status: {
      channel: "linkedin",
      status: "bridge_needed",
      fetched: 0,
      note: options.apifyToken ? "Apify token ready \u2014 push LinkedIn actor results to /api/ingest/webhook" : "Push LinkedIn signals via Webhook Bridge (/api/ingest/webhook)"
    }
  };
}

// src/lib/channels/reddit.ts
async function fetchRedditPosts(terms, fetchFn = fetch) {
  const uniqueTerms = terms.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (uniqueTerms.length === 0) {
    return {
      posts: [],
      status: { channel: "reddit", status: "live", fetched: 0, note: "No search terms configured" }
    };
  }
  const userAgent = getEnv("REDDIT_USER_AGENT") || "SignalScout/1.0 (+https://signalscout.app)";
  const seen = /* @__PURE__ */ new Set();
  const posts = [];
  try {
    for (const term of uniqueTerms) {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=new&t=week&limit=15`;
      const res = await fetchFn(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(6e3)
      });
      if (res.status === 429 || res.status === 403) {
        return {
          posts,
          status: {
            channel: "reddit",
            status: "rate_limited",
            fetched: posts.length,
            note: `Reddit returned HTTP ${res.status} (use OAuth or webhook bridge for high volume)`
          }
        };
      }
      if (!res.ok) {
        return {
          posts,
          status: {
            channel: "reddit",
            status: "error",
            fetched: posts.length,
            note: `Reddit HTTP ${res.status}`
          }
        };
      }
      const json2 = await res.json();
      for (const child of json2.data?.children ?? []) {
        const d = child.data;
        if (!d?.id || seen.has(d.id)) continue;
        seen.add(d.id);
        const body = (d.selftext || d.body || d.title || "").trim();
        const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : `https://www.reddit.com/comments/${d.id}`;
        posts.push({
          channel: "reddit",
          externalId: d.id,
          author: d.author || "redditor",
          authorHandle: d.author ? `u/${d.author}` : "u/redditor",
          title: d.title || "",
          body,
          url: permalink,
          community: d.subreddit_name_prefixed || "Reddit",
          publishedAt: d.created_utc ? new Date(d.created_utc * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
          sourceMode: "live"
        });
      }
    }
    return {
      posts,
      status: {
        channel: "reddit",
        status: "live",
        fetched: posts.length,
        note: `Live Reddit search (${posts.length} posts)`
      }
    };
  } catch (err) {
    return {
      posts,
      status: {
        channel: "reddit",
        status: "error",
        fetched: posts.length,
        note: err instanceof Error ? err.message : "Reddit fetch error"
      }
    };
  }
}

// src/lib/channels/x.ts
function buildSimulatedXPosts(terms) {
  const anchor = terms[0] || "social listening";
  const now = Date.now();
  return [
    {
      channel: "x",
      externalId: `sim_x_${Buffer.from(anchor).toString("hex").slice(0, 8)}_1`,
      author: "Maya Chen",
      authorHandle: "@mayachen_saas",
      title: "",
      body: `Anyone else sick of paying $40/mo extra just to track X mentions? Looking for an alternative to Syften that handles ${anchor} without spamming our Slack.`,
      url: "https://x.com/mayachen_saas/status/1855910201",
      community: "X / SaaS Founders",
      publishedAt: new Date(now - 1e3 * 60 * 18).toISOString(),
      sourceMode: "simulation"
    },
    {
      channel: "x",
      externalId: `sim_x_${Buffer.from(anchor).toString("hex").slice(0, 8)}_2`,
      author: "Growth Digest Bot",
      authorHandle: "@growthdigestbot",
      title: "",
      body: `Top 10 ${anchor} tools in 2026! Click here and use promo code GROWTH30 for 30% off #saas`,
      url: "https://x.com/growthdigestbot/status/1855910999",
      community: "X / Promo",
      publishedAt: new Date(now - 1e3 * 60 * 42).toISOString(),
      sourceMode: "simulation"
    }
  ];
}
async function fetchXPosts(terms, options = {}) {
  const token = options.xBearerToken?.trim();
  const fetchFn = options.fetchFn ?? fetch;
  const queryTerms = terms.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (token && queryTerms.length > 0) {
    try {
      const q = `(${queryTerms.map((t) => `"${t}"`).join(" OR ")}) -is:retweet lang:en`;
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=15&tweet.fields=created_at,author_id`;
      const res = await fetchFn(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6e3)
      });
      if (!res.ok) {
        return {
          posts: [],
          status: {
            channel: "x",
            status: res.status === 429 ? "rate_limited" : "error",
            fetched: 0,
            note: `X API v2 returned HTTP ${res.status}`
          }
        };
      }
      const data = await res.json();
      const posts = (data.data ?? []).map((t) => ({
        channel: "x",
        externalId: t.id,
        author: t.author_id || "X user",
        authorHandle: `@user_${t.author_id || t.id}`,
        title: "",
        body: t.text,
        url: `https://x.com/i/web/status/${t.id}`,
        community: "X",
        publishedAt: t.created_at || (/* @__PURE__ */ new Date()).toISOString(),
        sourceMode: "live"
      }));
      return {
        posts,
        status: { channel: "x", status: "live", fetched: posts.length, note: `Live X API v2 (${posts.length} posts)` }
      };
    } catch (err) {
      return {
        posts: [],
        status: { channel: "x", status: "error", fetched: 0, note: err instanceof Error ? err.message : "X API error" }
      };
    }
  }
  if (options.includeSimulation) {
    const posts = buildSimulatedXPosts(queryTerms);
    return {
      posts,
      status: {
        channel: "x",
        status: "simulated",
        fetched: posts.length,
        note: "Simulated X stream (connect X Bearer token or Webhook Bridge for live posts)"
      }
    };
  }
  return {
    posts: [],
    status: {
      channel: "x",
      status: "bridge_needed",
      fetched: 0,
      note: "Connect X Bearer Token or push via Webhook Bridge (/api/ingest/webhook)"
    }
  };
}

// src/lib/reply.ts
function cleanProductName(workspace) {
  const name = workspace.productName?.trim();
  return name && name.length > 0 ? name : "our tool";
}
function buildHook(post, analysis, tone) {
  const primaryPain = analysis.painPoints[0] || "filtering real buyer threads from noise";
  const authorFirst = post.author?.replace(/^u\/|^@/, "").split(/\s+/)[0] || "there";
  if (analysis.intentType === "competitor_complaint") {
    if (tone === "technical") {
      return `Totally feel this \u2014 ${primaryPain} is usually where simple keyword matchers break down once volume scales.`;
    }
    if (tone === "peer") {
      return `Hey ${authorFirst}, ran into this exact headache with ${primaryPain} too.`;
    }
    return `Totally hear you on ${primaryPain} \u2014 paying extra per channel only to still dig through false positives is exhausting.`;
  }
  if (analysis.intentType === "explicit_buying_intent") {
    if (tone === "technical") {
      return `If you're evaluating options right now, the biggest lever for ${primaryPain} is separating keyword recall from intent scoring.`;
    }
    return `Since you're actively comparing tools this week, happy to share what actually works for ${primaryPain}.`;
  }
  if (tone === "peer") {
    return `Went through a similar search recently when ${primaryPain} started eating too much time.`;
  }
  if (tone === "technical") {
    return `Good question \u2014 most teams hit a wall with ${primaryPain} when they rely on raw keyword alerts alone.`;
  }
  return `Saw your question \u2014 dealing with ${primaryPain} is the exact reason most folks start looking for a cleaner setup.`;
}
function buildValuePoints(post, analysis, tone) {
  const points = [];
  if (analysis.painPoints.includes("noisy keyword alerts") || analysis.intentType === "competitor_complaint") {
    points.push(
      tone === "technical" ? "Run a two-stage filter: cheap negative-keyword drop first, then LLM intent classification (recommendation request vs promo spam) before Slack." : "Separate keyword matching from intent filtering so listicles, hiring posts, and random mentions never ping Slack."
    );
  } else {
    points.push(
      tone === "technical" ? "Score threads by explicit intent (asking for alternatives, competitor pain, or active evaluation) rather than raw keyword frequency." : "Prioritize threads where someone is asking for recommendations or unhappy with a current tool rather than general chatter."
    );
  }
  if (analysis.painPoints.includes("channel add-on pricing") || post.channel === "x" || post.channel === "linkedin") {
    points.push("Watch out for tools that charge base fees plus $40/mo X and $20/mo channel add-ons \u2014 all-channel tools avoid surprise per-network upgrades.");
  } else {
    points.push("Pre-draft a non-salesy outline inside the alert so you can personalize and reply in 30 seconds instead of staring at a blank box.");
  }
  if (tone === "technical" && post.channel === "hackernews") {
    points.push("Deduplicate by thread/comment ID and keep a blocked-noise audit log so you can tune negative keywords with real data.");
  }
  return points.slice(0, 3);
}
function buildSoftMention(workspace, tone) {
  const product = cleanProductName(workspace);
  const urlPart = workspace.productUrl?.trim() ? ` (${workspace.productUrl.trim()})` : "";
  const desc = workspace.productDescription?.trim() ? workspace.productDescription.trim().replace(/\.$/, "") : "handles all-channel monitoring with LLM intent filtering and reply outlines";
  if (tone === "peer") {
    return `Worth checking out ${product}${urlPart} \u2014 ${desc.toLowerCase()}. Happy to share how we configured our filters if helpful.`;
  }
  if (tone === "technical") {
    return `Full disclosure: I'm building ${product}${urlPart}, which implements this two-stage pipeline (${desc.toLowerCase()}). Happy to walk through the architecture or share tradeoffs vs DIY.`;
  }
  return `Full disclosure: I'm building ${product}${urlPart} to solve this exact workflow \u2014 ${desc.toLowerCase()}. Happy to set up a test monitor for your keywords if you want to compare.`;
}
function generateReplyOutline(post, analysis, workspace, requestedTone) {
  const tone = requestedTone || workspace.defaultTone || "founder";
  const hook = buildHook(post, analysis, tone);
  const valuePoints = buildValuePoints(post, analysis, tone);
  const softMention = buildSoftMention(workspace, tone);
  if (post.channel === "x") {
    const conciseValue = valuePoints[0];
    const product = cleanProductName(workspace);
    const shortDisclosure = workspace.productName?.trim() ? `Disclosure: building ${product} (free across X, Reddit, HN, and LinkedIn with noise filtering) if you want to compare.` : softMention;
    const fullDraft2 = `${hook}

${conciseValue}

${shortDisclosure}`;
    return {
      hook,
      valuePoints,
      softMention: shortDisclosure,
      fullDraft: fullDraft2,
      tone
    };
  }
  const bullets = valuePoints.map((pt) => `- ${pt}`).join("\n");
  const fullDraft = `${hook}

A couple of things that help:
${bullets}

${softMention}`;
  return {
    hook,
    valuePoints,
    softMention,
    fullDraft,
    tone
  };
}

// src/lib/pipeline.ts
async function processCandidatePosts(db, workspace, monitor, posts, channelStatuses, opts) {
  let stage1Dropped = 0;
  let llmFilteredNoise = 0;
  let highIntentMatched = 0;
  let alertsDispatched = 0;
  for (const post of posts) {
    const alreadySeen = await db.hasLeadExternalId(monitor.id, post.channel, post.externalId);
    if (alreadySeen) continue;
    const stage1 = runStage1Filter(post, monitor);
    if (!stage1.passed) {
      stage1Dropped++;
      continue;
    }
    const analysis = await classifyIntent(post, monitor, workspace);
    const isFilteredNoise = !analysis.shouldAlert;
    if (isFilteredNoise) {
      llmFilteredNoise++;
      await db.insertLead({
        workspaceId: workspace.id,
        monitorId: monitor.id,
        channel: post.channel,
        externalId: post.externalId,
        author: post.author,
        authorHandle: post.authorHandle,
        title: post.title,
        body: post.body,
        url: post.url,
        community: post.community,
        intentType: analysis.intentType,
        confidenceScore: analysis.confidenceScore,
        buyingUrgency: analysis.buyingUrgency,
        reasoning: analysis.reasoning,
        painPoints: analysis.painPoints,
        isFilteredNoise: true,
        replyHook: "",
        replyValuePoints: [],
        replySoftMention: "",
        replyDraft: "",
        replyTone: workspace.defaultTone,
        status: "dismissed",
        alertSentSlack: false,
        alertSentDiscord: false,
        sourceMode: post.sourceMode,
        publishedAt: post.publishedAt
      });
      continue;
    }
    highIntentMatched++;
    const reply = generateReplyOutline(post, analysis, workspace, workspace.defaultTone);
    const inserted = await db.insertLead({
      workspaceId: workspace.id,
      monitorId: monitor.id,
      channel: post.channel,
      externalId: post.externalId,
      author: post.author,
      authorHandle: post.authorHandle,
      title: post.title,
      body: post.body,
      url: post.url,
      community: post.community,
      intentType: analysis.intentType,
      confidenceScore: analysis.confidenceScore,
      buyingUrgency: analysis.buyingUrgency,
      reasoning: analysis.reasoning,
      painPoints: analysis.painPoints,
      isFilteredNoise: false,
      replyHook: reply.hook,
      replyValuePoints: reply.valuePoints,
      replySoftMention: reply.softMention,
      replyDraft: reply.fullDraft,
      replyTone: reply.tone,
      status: "new",
      alertSentSlack: false,
      alertSentDiscord: false,
      sourceMode: post.sourceMode,
      publishedAt: post.publishedAt
    });
    if (inserted) {
      const dispatch2 = await dispatchWebhookAlerts(inserted, monitor, workspace, opts.fetchFn);
      if (dispatch2.slackSent || dispatch2.discordSent) {
        alertsDispatched++;
        await db.updateLead(workspace.id, inserted.id, {
          alertSentSlack: dispatch2.slackSent,
          alertSentDiscord: dispatch2.discordSent
        });
      }
    }
  }
  await db.updateMonitor(workspace.id, monitor.id, {
    lastScannedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return db.insertScanRun({
    workspaceId: workspace.id,
    monitorId: monitor.id,
    triggerType: opts.triggerType,
    postsFetched: posts.length,
    stage1Dropped,
    llmFilteredNoise,
    highIntentMatched,
    alertsDispatched,
    channelStatuses
  });
}
async function runMonitorScan(db, workspace, monitor, options) {
  const fetchFn = options.fetchFn ?? fetch;
  const searchTerms = [...monitor.competitors, ...monitor.keywords].filter(Boolean);
  const channelStatuses = {};
  const allPosts = [];
  if (options.incomingPosts) {
    allPosts.push(...options.incomingPosts);
  } else {
    const tasks = monitor.channels.map(async (channel) => {
      const customFetcher = options.channelFetchers?.[channel];
      if (customFetcher) {
        return customFetcher(searchTerms);
      }
      if (channel === "hackernews") {
        return fetchHackerNewsPosts(searchTerms, fetchFn);
      }
      if (channel === "reddit") {
        return fetchRedditPosts(searchTerms, fetchFn);
      }
      if (channel === "x") {
        return fetchXPosts(searchTerms, {
          xBearerToken: workspace.xBearerToken,
          includeSimulation: options.includeSimulation,
          fetchFn
        });
      }
      return fetchLinkedInPosts(searchTerms, {
        apifyToken: workspace.apifyToken,
        includeSimulation: options.includeSimulation
      });
    });
    const results = await Promise.all(tasks);
    for (const res of results) {
      channelStatuses[res.status.channel] = res.status;
      allPosts.push(...res.posts);
    }
  }
  return processCandidatePosts(db, workspace, monitor, allPosts, channelStatuses, {
    triggerType: options.triggerType,
    fetchFn
  });
}
async function regenerateLeadReply(db, workspace, lead, tone) {
  const post = {
    channel: lead.channel,
    externalId: lead.externalId,
    author: lead.author,
    authorHandle: lead.authorHandle,
    title: lead.title,
    body: lead.body,
    url: lead.url,
    community: lead.community,
    publishedAt: lead.publishedAt,
    sourceMode: lead.sourceMode
  };
  const outline = generateReplyOutline(
    post,
    {
      intentType: lead.intentType,
      confidenceScore: lead.confidenceScore,
      buyingUrgency: lead.buyingUrgency,
      reasoning: lead.reasoning,
      painPoints: lead.painPoints,
      shouldAlert: !lead.isFilteredNoise,
      classifierMode: "heuristic"
    },
    workspace,
    tone
  );
  return db.updateLead(workspace.id, lead.id, {
    replyHook: outline.hook,
    replyValuePoints: outline.valuePoints,
    replySoftMention: outline.softMention,
    replyDraft: outline.fullDraft,
    replyTone: outline.tone
  });
}

// src/lib/seed.ts
var DEMO_EMAIL = "demo@signalscout.app";
var DEMO_PASSWORD = "demo-signalscout-password";
async function ensureDemoWorkspace(db) {
  const existingUser = await db.findUserByEmail(DEMO_EMAIL);
  if (existingUser) {
    const existingWs = await db.getWorkspaceByOwner(existingUser.id);
    if (existingWs) {
      return { user: existingUser, workspace: existingWs };
    }
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const { user, workspace } = await db.createUserWithWorkspace({
    email: DEMO_EMAIL,
    name: "Maya Founder",
    passwordHash,
    companyName: "SignalScout Demo",
    productName: "SignalScout",
    productDescription: "Free buying-intent listener across Reddit, X, LinkedIn, and Hacker News with noise filtering and ready-to-edit reply drafts.",
    productUrl: "https://signalscout.app",
    plan: "free"
  });
  const monitor = await db.createMonitor({
    workspaceId: workspace.id,
    name: "Syften & Octolens Switchers",
    keywords: ["social listening", "reddit monitoring", "buying intent"],
    competitors: ["syften", "octolens", "f5bot"],
    negativeKeywords: ["hiring", "internship", "crypto giveaway"],
    channels: ["reddit", "x", "linkedin", "hackernews"],
    minConfidence: 70
  });
  const now = Date.now();
  const seedPosts = [
    {
      channel: "reddit",
      externalId: "demo_reddit_1",
      author: "saas_kyle",
      authorHandle: "u/saas_kyle",
      title: "Looking for an alternative to Syften \u2014 X add-on pricing is getting out of hand",
      body: "We've been paying $29.95/mo for basic Reddit + $40/mo just for X monitoring and still get flooded with false positives. What are other B2B SaaS teams switching to?",
      url: "https://www.reddit.com/r/SaaS/",
      community: "r/SaaS",
      publishedAt: new Date(now - 1e3 * 60 * 35).toISOString(),
      sourceMode: "simulation"
    },
    {
      channel: "hackernews",
      externalId: "demo_hn_1",
      author: "tomas_dev",
      authorHandle: "tomas_dev",
      title: "Ask HN: Best buying-intent social listening tool that doesn't spam Slack?",
      body: "Octolens keeps sending 150 noisy keyword matches every week, and we still spend 20 minutes figuring out how to reply without sounding like a corporate shill.",
      url: "https://news.ycombinator.com/",
      community: "Ask HN",
      publishedAt: new Date(now - 1e3 * 60 * 75).toISOString(),
      sourceMode: "simulation"
    },
    {
      channel: "linkedin",
      externalId: "demo_li_1",
      author: "Elena Vance",
      authorHandle: "Elena Vance \u2022 Head of Growth",
      title: "",
      body: "Evaluating social listening tools this week for our outbound team. Budget approved up to $50/mo if it covers Reddit, LinkedIn, X, and HN cleanly without per-channel add-ons.",
      url: "https://www.linkedin.com/",
      community: "LinkedIn Feed",
      publishedAt: new Date(now - 1e3 * 60 * 110).toISOString(),
      sourceMode: "simulation"
    },
    {
      channel: "x",
      externalId: "demo_x_noise_1",
      author: "GrowthListicles",
      authorHandle: "@growthlisticles",
      title: "Top 12 Social Listening Tools in 2026 [Thread]",
      body: "Just published a guide comparing Syften, Octolens, and social listening workflows on our blog!",
      url: "https://x.com/",
      community: "X",
      publishedAt: new Date(now - 1e3 * 60 * 140).toISOString(),
      sourceMode: "simulation"
    },
    {
      channel: "reddit",
      externalId: "demo_reddit_noise_2",
      author: "intern_hunter",
      authorHandle: "u/intern_hunter",
      title: "Best 10 Reddit monitoring tips in 2026",
      body: "Just published a guide on our blog covering social listening workflows and growth hacks.",
      url: "https://www.reddit.com/r/marketing/",
      community: "r/marketing",
      publishedAt: new Date(now - 1e3 * 60 * 180).toISOString(),
      sourceMode: "simulation"
    }
  ];
  await processCandidatePosts(
    db,
    workspace,
    monitor,
    seedPosts,
    {
      reddit: { channel: "reddit", status: "simulated", fetched: 2, note: "Demo workspace starter signal" },
      hackernews: { channel: "hackernews", status: "simulated", fetched: 1, note: "Demo workspace starter signal" },
      linkedin: { channel: "linkedin", status: "simulated", fetched: 1, note: "Demo workspace starter signal" },
      x: { channel: "x", status: "simulated", fetched: 1, note: "Demo workspace starter signal" }
    },
    { triggerType: "manual" }
  );
  return { user, workspace };
}

// src/lib/router.ts
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
function sanitizeWorkspace(ws) {
  return {
    id: ws.id,
    name: ws.name,
    productName: ws.productName,
    productDescription: ws.productDescription,
    productUrl: ws.productUrl,
    idealCustomer: ws.idealCustomer,
    defaultTone: ws.defaultTone,
    plan: "free",
    slackWebhookUrl: ws.slackWebhookUrl,
    discordWebhookUrl: ws.discordWebhookUrl,
    ingestSecret: ws.ingestSecret,
    customOpenaiKeySet: Boolean(ws.customOpenaiKey),
    xBearerTokenSet: Boolean(ws.xBearerToken),
    apifyTokenSet: Boolean(ws.apifyToken),
    createdAt: ws.createdAt
  };
}
async function readJsonBody(req) {
  try {
    const parsed = await req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
async function requireAuth(req, db) {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  let user = await db.getUserById(session.userId);
  let workspace = await db.getWorkspaceById(session.workspaceId);
  if ((!user || !workspace) && session.email === "demo@signalscout.app") {
    const seeded = await ensureDemoWorkspace(db);
    user = seeded.user;
    workspace = seeded.workspace;
  }
  if (!user || !workspace) return null;
  return { user, workspace };
}
function asTrimmedString(val) {
  return typeof val === "string" ? val.trim() : "";
}
function parseTerms(input) {
  if (Array.isArray(input)) {
    return input.filter((v) => typeof v === "string" || typeof v === "number").map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
function parseConfidence(input, fallback = 70) {
  const num = Number(input);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(40, Math.min(98, Math.round(num)));
}
function parseIsoTimestamp(input) {
  if (typeof input === "string" && input.trim()) {
    const ms = Date.parse(input);
    if (Number.isFinite(ms)) {
      return new Date(ms).toISOString();
    }
  }
  return (/* @__PURE__ */ new Date()).toISOString();
}
function parseSafeExternalUrl(input, fallback) {
  const raw = asTrimmedString(input);
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
  }
  return fallback;
}
var ALLOWED_CHANNELS = ["reddit", "x", "linkedin", "hackernews"];
var ALLOWED_STATUSES = ["new", "replied", "dismissed"];
var ALLOWED_TONES = ["founder", "peer", "technical"];
function parseChannels(input) {
  if (!Array.isArray(input)) return [...ALLOWED_CHANNELS];
  const filtered = input.filter((c) => ALLOWED_CHANNELS.includes(c));
  return filtered.length > 0 ? filtered : [...ALLOWED_CHANNELS];
}
function parseTone(input, fallback = "founder") {
  return typeof input === "string" && ALLOWED_TONES.includes(input) ? input : fallback;
}
async function handleApiRequest(req, db, opts = {}) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method.toUpperCase();
  const fetchFn = opts.fetchFn ?? fetch;
  try {
    if (method === "GET" && path === "/api/health") {
      return json({
        ok: true,
        service: "SignalScout",
        free: true,
        database: getEnv("NETLIFY_DB_URL") || getEnv("DATABASE_URL") ? "postgres" : "memory",
        aiGatewayActive: Boolean(getEnv("OPENAI_BASE_URL") || getEnv("OPENAI_API_KEY")),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (method === "POST" && path === "/api/demo/evaluate") {
      const body = await readJsonBody(req);
      const postTitle = asTrimmedString(body?.title);
      const postBody = asTrimmedString(body?.body);
      if (!body || !postBody && !postTitle) {
        return json({ error: "Enter a post title or body to evaluate." }, 400);
      }
      const channel = ALLOWED_CHANNELS.includes(body.channel) ? body.channel : "reddit";
      const handle = asTrimmedString(body.authorHandle) || (channel === "x" ? "@prospect" : "u/prospect");
      const tone = parseTone(body.tone, "founder");
      const post = {
        channel,
        externalId: `playground_${Date.now()}`,
        author: "prospect",
        authorHandle: handle,
        title: postTitle,
        body: postBody,
        url: channel === "hackernews" ? "https://news.ycombinator.com/item?id=42000" : channel === "x" ? "https://x.com/prospect/status/185500000" : channel === "linkedin" ? "https://www.linkedin.com/feed/" : "https://www.reddit.com/r/SaaS/",
        community: channel === "reddit" ? "r/SaaS" : channel === "hackernews" ? "Ask HN" : channel.toUpperCase(),
        publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
        sourceMode: "simulation"
      };
      const parsedKeywords = parseTerms(body.keywords);
      const parsedCompetitors = parseTerms(body.competitors);
      const tempMonitor = {
        id: "mon_playground",
        workspaceId: "ws_playground",
        name: "Topic Preview",
        keywords: parsedKeywords.length > 0 ? parsedKeywords : ["social listening", "monitoring"],
        competitors: parsedCompetitors.length > 0 ? parsedCompetitors : ["syften", "octolens"],
        negativeKeywords: parseTerms(body.negativeKeywords),
        channels: [...ALLOWED_CHANNELS],
        minConfidence: 70,
        isActive: true,
        lastScannedAt: null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const tempWorkspace = {
        id: "ws_playground",
        ownerUserId: "usr_playground",
        name: "Preview",
        productName: asTrimmedString(body.productName) || "SignalScout",
        productDescription: asTrimmedString(body.productDescription) || "Free buying-intent listening across Reddit, X, LinkedIn, and Hacker News with noise filtering and ready-to-edit reply drafts.",
        productUrl: "https://signalscout.app",
        idealCustomer: "SaaS founders",
        defaultTone: tone,
        plan: "free",
        trialEndsAt: (/* @__PURE__ */ new Date()).toISOString(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        slackWebhookUrl: "",
        discordWebhookUrl: "",
        customOpenaiKey: "",
        xBearerToken: "",
        apifyToken: "",
        ingestSecret: "playground",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const stage1 = runStage1Filter(post, tempMonitor);
      const analysis = stage1.passed ? await classifyIntent(post, tempMonitor, tempWorkspace) : {
        intentType: "noise_or_irrelevant",
        confidenceScore: 10,
        buyingUrgency: "low",
        reasoning: `Dropped in Stage 1 pre-filter (${stage1.reason}) \u2014 zero LLM tokens spent.`,
        painPoints: [],
        shouldAlert: false,
        classifierMode: "heuristic"
      };
      const reply = generateReplyOutline(post, analysis, tempWorkspace, tone);
      const previewLead = {
        id: "lead_preview",
        workspaceId: tempWorkspace.id,
        monitorId: tempMonitor.id,
        channel: post.channel,
        externalId: post.externalId,
        author: post.author,
        authorHandle: post.authorHandle,
        title: post.title,
        body: post.body,
        url: post.url,
        community: post.community,
        intentType: analysis.intentType,
        confidenceScore: analysis.confidenceScore,
        buyingUrgency: analysis.buyingUrgency,
        reasoning: analysis.reasoning,
        painPoints: analysis.painPoints,
        isFilteredNoise: !analysis.shouldAlert,
        replyHook: reply.hook,
        replyValuePoints: reply.valuePoints,
        replySoftMention: reply.softMention,
        replyDraft: reply.fullDraft,
        replyTone: reply.tone,
        status: "new",
        alertSentSlack: false,
        alertSentDiscord: false,
        sourceMode: "simulation",
        publishedAt: post.publishedAt,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return json({
        stage1,
        analysis,
        reply,
        slackPayload: buildSlackPayload(previewLead, tempMonitor)
      });
    }
    if (method === "POST" && path === "/api/auth/register") {
      const body = await readJsonBody(req);
      const email = asTrimmedString(body?.email);
      const name = asTrimmedString(body?.name);
      const password = typeof body?.password === "string" ? body.password : "";
      const companyName = asTrimmedString(body?.companyName);
      const productName = asTrimmedString(body?.productName);
      const productDescription = asTrimmedString(body?.productDescription);
      if (!email.includes("@") || password.length < 6 || !name) {
        return json({ error: "Name, valid email, and password (6+ characters) are required." }, 400);
      }
      const existing = await db.findUserByEmail(email);
      if (existing) {
        return json({ error: "An account with this email already exists." }, 409);
      }
      const passwordHash = await hashPassword(password);
      const { user: user2, workspace: workspace2 } = await db.createUserWithWorkspace({
        email,
        name,
        passwordHash,
        companyName: companyName || void 0,
        productName: productName || companyName || "My Product",
        productDescription: productDescription || void 0,
        plan: "free"
      });
      const token = await signSessionToken({ userId: user2.id, workspaceId: workspace2.id, email: user2.email });
      return json(
        { user: { id: user2.id, email: user2.email, name: user2.name }, workspace: sanitizeWorkspace(workspace2) },
        201,
        { "Set-Cookie": buildSessionCookie(token) }
      );
    }
    if (method === "POST" && path === "/api/auth/login") {
      const body = await readJsonBody(req);
      const email = asTrimmedString(body?.email);
      const password = typeof body?.password === "string" ? body.password : "";
      if (!email || !password) {
        return json({ error: "Email and password are required." }, 400);
      }
      const user2 = await db.findUserByEmail(email);
      if (!user2 || !await verifyPassword(password, user2.passwordHash)) {
        return json({ error: "Invalid email or password." }, 401);
      }
      const workspace2 = await db.getWorkspaceByOwner(user2.id);
      if (!workspace2) {
        return json({ error: "Workspace not found." }, 404);
      }
      const token = await signSessionToken({ userId: user2.id, workspaceId: workspace2.id, email: user2.email });
      return json(
        { user: { id: user2.id, email: user2.email, name: user2.name }, workspace: sanitizeWorkspace(workspace2) },
        200,
        { "Set-Cookie": buildSessionCookie(token) }
      );
    }
    if (method === "POST" && path === "/api/auth/demo") {
      const { user: user2, workspace: workspace2 } = await ensureDemoWorkspace(db);
      const token = await signSessionToken({ userId: user2.id, workspaceId: workspace2.id, email: user2.email });
      return json(
        { user: { id: user2.id, email: user2.email, name: user2.name }, workspace: sanitizeWorkspace(workspace2) },
        200,
        { "Set-Cookie": buildSessionCookie(token) }
      );
    }
    if (method === "POST" && path === "/api/auth/logout") {
      return json({ ok: true }, 200, { "Set-Cookie": buildClearSessionCookie() });
    }
    if (method === "POST" && path === "/api/ingest/webhook") {
      const secret = url.searchParams.get("secret") || req.headers.get("x-signalscout-secret") || "";
      if (!secret) {
        return json({ error: "Missing webhook ingest secret." }, 401);
      }
      const workspace2 = await db.getWorkspaceByIngestSecret(secret);
      if (!workspace2) {
        return json({ error: "Invalid webhook ingest secret." }, 401);
      }
      const body = await readJsonBody(req);
      if (!body || !Array.isArray(body.posts)) {
        return json({ error: "Request body must include a posts array." }, 400);
      }
      const monitors = await db.listMonitors(workspace2.id);
      const requestedMonitorId = asTrimmedString(body.monitorId);
      const targetMonitor = (requestedMonitorId ? monitors.find((m) => m.id === requestedMonitorId) : monitors.find((m) => m.isActive)) ?? monitors[0];
      if (!targetMonitor) {
        return json({ error: "Create a topic to watch before sending posts via webhook." }, 400);
      }
      const rawPosts = [];
      for (let idx = 0; idx < body.posts.length; idx++) {
        const entry = body.posts[idx];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const p = entry;
        const postBody = asTrimmedString(p.body);
        if (!postBody) continue;
        const ch = ALLOWED_CHANNELS.includes(p.channel) ? p.channel : "x";
        const author = asTrimmedString(p.author) || "Author";
        rawPosts.push({
          channel: ch,
          externalId: asTrimmedString(p.externalId) || `wh_${Date.now()}_${idx}`,
          author,
          authorHandle: asTrimmedString(p.authorHandle) || author,
          title: asTrimmedString(p.title),
          body: postBody,
          url: parseSafeExternalUrl(p.url, "https://signalscout.app"),
          community: asTrimmedString(p.community) || ch.toUpperCase(),
          publishedAt: parseIsoTimestamp(p.publishedAt),
          sourceMode: "webhook"
        });
      }
      if (rawPosts.length === 0) {
        return json({ error: "Provide at least one post with non-empty body text." }, 400);
      }
      const scanRun = await processCandidatePosts(
        db,
        workspace2,
        targetMonitor,
        rawPosts,
        {
          webhook: {
            channel: rawPosts[0].channel,
            status: "live",
            fetched: rawPosts.length,
            note: `Ingested ${rawPosts.length} post(s) via webhook bridge`
          }
        },
        { triggerType: "webhook", fetchFn }
      );
      return json({ ok: true, scanRun });
    }
    const auth = await requireAuth(req, db);
    if (!auth) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { user, workspace } = auth;
    if (method === "GET" && path === "/api/auth/me") {
      const [stats, monitors, scanRuns] = await Promise.all([
        db.getWorkspaceStats(workspace.id),
        db.listMonitors(workspace.id),
        db.listScanRuns(workspace.id, 10)
      ]);
      return json({
        user: { id: user.id, email: user.email, name: user.name, companyName: user.companyName },
        workspace: sanitizeWorkspace(workspace),
        stats,
        monitors,
        scanRuns
      });
    }
    if (method === "GET" && path === "/api/monitors") {
      const monitors = await db.listMonitors(workspace.id);
      return json({ monitors });
    }
    if (method === "POST" && path === "/api/monitors") {
      const body = await readJsonBody(req);
      const name = asTrimmedString(body?.name);
      const keywords = parseTerms(body?.keywords);
      const competitors = parseTerms(body?.competitors);
      if (!name || keywords.length === 0 && competitors.length === 0) {
        return json({ error: "Give this topic a name and at least one keyword or competitor." }, 400);
      }
      const monitor = await db.createMonitor({
        workspaceId: workspace.id,
        name,
        keywords,
        competitors,
        negativeKeywords: parseTerms(body?.negativeKeywords),
        channels: parseChannels(body?.channels),
        minConfidence: parseConfidence(body?.minConfidence, 70)
      });
      return json({ monitor }, 201);
    }
    const monitorMatch = path.match(/^\/api\/monitors\/([^/]+)$/);
    if (monitorMatch) {
      const monitorId = decodeURIComponent(monitorMatch[1]);
      if (method === "PATCH") {
        const body = await readJsonBody(req);
        if (!body) return json({ error: "Invalid JSON body." }, 400);
        const patch = {};
        if (body.name !== void 0) {
          const trimmed = asTrimmedString(body.name);
          if (!trimmed) return json({ error: "Topic name cannot be empty." }, 400);
          patch.name = trimmed;
        }
        if (body.keywords !== void 0) patch.keywords = parseTerms(body.keywords);
        if (body.competitors !== void 0) patch.competitors = parseTerms(body.competitors);
        if (body.negativeKeywords !== void 0) patch.negativeKeywords = parseTerms(body.negativeKeywords);
        if (body.channels !== void 0) patch.channels = parseChannels(body.channels);
        if (body.minConfidence !== void 0) patch.minConfidence = parseConfidence(body.minConfidence, 70);
        if (body.isActive !== void 0) patch.isActive = Boolean(body.isActive);
        const updated = await db.updateMonitor(workspace.id, monitorId, patch);
        return updated ? json({ monitor: updated }) : json({ error: "Topic not found." }, 404);
      }
      if (method === "DELETE") {
        const deleted = await db.deleteMonitor(workspace.id, monitorId);
        return deleted ? json({ ok: true }) : json({ error: "Topic not found." }, 404);
      }
    }
    if (method === "GET" && path === "/api/leads") {
      const rawChannel = url.searchParams.get("channel") || "all";
      const channel = ALLOWED_CHANNELS.includes(rawChannel) ? rawChannel : "all";
      const rawStatus = url.searchParams.get("status") || "all";
      const status = ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : "all";
      const filter = url.searchParams.get("filter") || "intent";
      const [leads, noise, stats] = await Promise.all([
        db.listLeads(workspace.id, { channel, status, includeNoise: false }),
        filter === "all" || filter === "noise" ? db.listLeads(workspace.id, { channel, onlyNoise: true }) : Promise.resolve([]),
        db.getWorkspaceStats(workspace.id)
      ]);
      return json({ leads, noise, stats });
    }
    const leadRegenMatch = path.match(/^\/api\/leads\/([^/]+)\/regenerate-reply$/);
    if (leadRegenMatch && method === "POST") {
      const lead = await db.getLead(workspace.id, decodeURIComponent(leadRegenMatch[1]));
      if (!lead) return json({ error: "Lead not found." }, 404);
      const body = await readJsonBody(req);
      const tone = parseTone(body?.tone, workspace.defaultTone);
      const updated = await regenerateLeadReply(db, workspace, lead, tone);
      return json({ lead: updated });
    }
    const leadSlackMatch = path.match(/^\/api\/leads\/([^/]+)\/send-slack$/);
    if (leadSlackMatch && method === "POST") {
      const lead = await db.getLead(workspace.id, decodeURIComponent(leadSlackMatch[1]));
      if (!lead) return json({ error: "Lead not found." }, 404);
      const monitor = await db.getMonitor(workspace.id, lead.monitorId) ?? {
        id: lead.monitorId,
        workspaceId: workspace.id,
        name: "Archived Topic",
        keywords: [],
        competitors: [],
        negativeKeywords: [],
        channels: [lead.channel],
        minConfidence: 70,
        isActive: false,
        lastScannedAt: null,
        createdAt: lead.createdAt
      };
      if (!workspace.slackWebhookUrl && !workspace.discordWebhookUrl) {
        return json({ error: "Add a Slack or Discord webhook URL in Notifications first." }, 400);
      }
      const dispatch2 = await dispatchWebhookAlerts(lead, monitor, workspace, fetchFn);
      const updated = await db.updateLead(workspace.id, lead.id, {
        alertSentSlack: lead.alertSentSlack || dispatch2.slackSent,
        alertSentDiscord: lead.alertSentDiscord || dispatch2.discordSent
      });
      return json({ lead: updated, dispatch: dispatch2 });
    }
    const leadMatch = path.match(/^\/api\/leads\/([^/]+)$/);
    if (leadMatch && method === "PATCH") {
      const body = await readJsonBody(req);
      if (!body) return json({ error: "Invalid JSON body." }, 400);
      const patch = {};
      if (typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status)) {
        patch.status = body.status;
      }
      if (typeof body.replyDraft === "string") {
        patch.replyDraft = body.replyDraft;
      }
      const updated = await db.updateLead(workspace.id, decodeURIComponent(leadMatch[1]), patch);
      return updated ? json({ lead: updated }) : json({ error: "Lead not found." }, 404);
    }
    if (method === "POST" && path === "/api/scan") {
      const body = await readJsonBody(req);
      const monitors = await db.listMonitors(workspace.id);
      const requestedId = asTrimmedString(body?.monitorId);
      const targets = requestedId ? monitors.filter((m) => m.id === requestedId) : monitors.filter((m) => m.isActive);
      if (targets.length === 0) {
        return json({ error: "No active topics to scan. Add or resume a topic first." }, 400);
      }
      const runs = [];
      for (const mon of targets.slice(0, 5)) {
        const run = await runMonitorScan(db, workspace, mon, {
          triggerType: "manual",
          includeSimulation: typeof body?.includeSimulation === "boolean" ? body.includeSimulation : true,
          fetchFn
        });
        runs.push(run);
      }
      const stats = await db.getWorkspaceStats(workspace.id);
      return json({ ok: true, runs, stats });
    }
    if (method === "GET" && path === "/api/settings") {
      return json({ workspace: sanitizeWorkspace(workspace) });
    }
    if (method === "PATCH" && path === "/api/settings") {
      const body = await readJsonBody(req);
      if (!body) return json({ error: "Invalid JSON body." }, 400);
      const patch = {};
      if (typeof body.name === "string") patch.name = body.name.trim();
      if (typeof body.productName === "string") patch.productName = body.productName.trim();
      if (typeof body.productDescription === "string") patch.productDescription = body.productDescription.trim();
      if (typeof body.productUrl === "string") {
        const trimmedUrl = body.productUrl.trim();
        if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
          return json({ error: "Product URL must start with https:// or http://." }, 400);
        }
        patch.productUrl = trimmedUrl;
      }
      if (typeof body.idealCustomer === "string") patch.idealCustomer = body.idealCustomer.trim();
      if (typeof body.defaultTone === "string" && ALLOWED_TONES.includes(body.defaultTone)) {
        patch.defaultTone = body.defaultTone;
      }
      if (typeof body.slackWebhookUrl === "string") {
        const trimmed = body.slackWebhookUrl.trim();
        if (trimmed && !isSafeWebhookEndpoint(trimmed)) {
          return json({ error: "Slack webhook URL must be a public https:// address." }, 400);
        }
        patch.slackWebhookUrl = trimmed;
      }
      if (typeof body.discordWebhookUrl === "string") {
        const trimmed = body.discordWebhookUrl.trim();
        if (trimmed && !isSafeWebhookEndpoint(trimmed)) {
          return json({ error: "Discord webhook URL must be a public https:// address." }, 400);
        }
        patch.discordWebhookUrl = trimmed;
      }
      if (typeof body.customOpenaiKey === "string" && body.customOpenaiKey !== "***") {
        patch.customOpenaiKey = body.customOpenaiKey.trim();
      }
      if (typeof body.xBearerToken === "string" && body.xBearerToken !== "***") {
        patch.xBearerToken = body.xBearerToken.trim();
      }
      if (typeof body.apifyToken === "string" && body.apifyToken !== "***") {
        patch.apifyToken = body.apifyToken.trim();
      }
      const updated = await db.updateWorkspace(workspace.id, patch);
      return json({ workspace: updated ? sanitizeWorkspace(updated) : null });
    }
    if (method === "POST" && path === "/api/settings/test-webhook") {
      if (!workspace.slackWebhookUrl && !workspace.discordWebhookUrl) {
        return json({ error: "Enter a Slack or Discord webhook URL first." }, 400);
      }
      const sampleMonitor = (await db.listMonitors(workspace.id))[0] ?? {
        id: "mon_test",
        workspaceId: workspace.id,
        name: "SignalScout Test Topic",
        keywords: ["social listening"],
        competitors: ["syften"],
        negativeKeywords: [],
        channels: [...ALLOWED_CHANNELS],
        minConfidence: 70,
        isActive: true,
        lastScannedAt: null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const sampleLead = {
        id: "lead_test",
        workspaceId: workspace.id,
        monitorId: sampleMonitor.id,
        channel: "reddit",
        externalId: "test_ping",
        author: "test_founder",
        authorHandle: "u/test_founder",
        title: "Test notification: Looking for an alternative to Syften without X add-ons?",
        body: "This is a live test notification from SignalScout verifying your Slack/Discord alert card and reply draft formatting.",
        url: "https://www.reddit.com/r/SaaS/",
        community: "r/SaaS",
        intentType: "recommendation_request",
        confidenceScore: 94,
        buyingUrgency: "high",
        reasoning: "Test notification confirming intent reasoning and reply draft render cleanly in Slack or Discord.",
        painPoints: ["channel add-on pricing", "noisy Slack alerts"],
        isFilteredNoise: false,
        replyHook: "Paying per-channel add-ons only to wade through keyword spam is frustrating.",
        replyValuePoints: [
          "Filter mentions by buying intent before Slack",
          "Covers Reddit, X, LinkedIn, and Hacker News for free"
        ],
        replySoftMention: `Full disclosure: building ${workspace.productName || "SignalScout"} for this exact workflow.`,
        replyDraft: `Paying per-channel add-ons only to wade through keyword spam is frustrating.

- Filter mentions by buying intent before Slack
- Covers Reddit, X, LinkedIn, and Hacker News for free

Full disclosure: building ${workspace.productName || "SignalScout"} for this exact workflow.`,
        replyTone: workspace.defaultTone,
        status: "new",
        alertSentSlack: false,
        alertSentDiscord: false,
        sourceMode: "simulation",
        publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const dispatch2 = await dispatchWebhookAlerts(sampleLead, sampleMonitor, workspace, fetchFn);
      return json({ ok: dispatch2.slackSent || dispatch2.discordSent, dispatch: dispatch2 });
    }
    if (method === "GET" && path === "/api/billing") {
      const stats = await db.getWorkspaceStats(workspace.id);
      return json({
        ...getFreePlanStatus(),
        stats
      });
    }
    if (method === "POST" && (path === "/api/billing/subscribe" || path === "/api/billing/cancel")) {
      return json(getFreePlanStatus());
    }
    return json({ error: `Route not found: ${method} ${path}` }, 404);
  } catch (err) {
    console.error("API Error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
}

// api/index.ts
async function dispatch(req) {
  const url = new URL(req.url);
  const routeParam = url.searchParams.get("__route");
  if (routeParam !== null && (url.pathname === "/api/index" || url.pathname === "/api/vercel" || url.pathname === "/api")) {
    url.pathname = `/api/${routeParam}`.replace(/\/+$/, "") || "/api";
    url.searchParams.delete("__route");
    const forwarded = new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? void 0 : req.body,
      // @ts-expect-error Node 24 duplex streaming option when body is a stream
      duplex: "half"
    });
    return handleApiRequest(forwarded, getDb());
  }
  return handleApiRequest(req, getDb());
}
async function GET(req) {
  return dispatch(req);
}
async function POST(req) {
  return dispatch(req);
}
async function PATCH(req) {
  return dispatch(req);
}
async function PUT(req) {
  return dispatch(req);
}
async function DELETE(req) {
  return dispatch(req);
}
export {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT
};

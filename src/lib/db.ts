import { randomBytes, randomUUID } from "node:crypto";
import { getDatabase } from "@netlify/database";
import { getEnv } from "./env";
import type {
  BillingEventRecord,
  BuyingUrgency,
  Channel,
  ChannelFetchStatus,
  IntentType,
  LeadRecord,
  LeadStatus,
  MonitorRecord,
  PlanTier,
  ReplyTone,
  ScanRunRecord,
  SourceMode,
  UserRecord,
  WorkspaceRecord,
} from "./types";

export interface CreateUserWorkspaceInput {
  email: string;
  name: string;
  passwordHash: string;
  companyName?: string;
  productName?: string;
  productDescription?: string;
  productUrl?: string;
  slackWebhookUrl?: string;
  plan?: PlanTier;
}

export interface CreateMonitorInput {
  workspaceId: string;
  name: string;
  keywords: string[];
  competitors: string[];
  negativeKeywords: string[];
  channels: Channel[];
  minConfidence: number;
}

export interface InsertLeadInput {
  workspaceId: string;
  monitorId: string;
  channel: Channel;
  externalId: string;
  author: string;
  authorHandle: string;
  title: string;
  body: string;
  url: string;
  community: string;
  intentType: IntentType;
  confidenceScore: number;
  buyingUrgency: BuyingUrgency;
  reasoning: string;
  painPoints: string[];
  isFilteredNoise: boolean;
  replyHook: string;
  replyValuePoints: string[];
  replySoftMention: string;
  replyDraft: string;
  replyTone: ReplyTone;
  status: LeadStatus;
  alertSentSlack: boolean;
  alertSentDiscord: boolean;
  sourceMode: SourceMode;
  publishedAt: string;
}

export interface WorkspaceStats {
  totalLeads: number;
  newLeads: number;
  repliedLeads: number;
  noiseBlocked: number;
  alertsSent: number;
  activeMonitors: number;
  avgConfidence: number;
}

export interface SignalScoutDb {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  getWorkspaceById(workspaceId: string): Promise<WorkspaceRecord | null>;
  getWorkspaceByOwner(userId: string): Promise<WorkspaceRecord | null>;
  getWorkspaceByIngestSecret(secret: string): Promise<WorkspaceRecord | null>;
  createUserWithWorkspace(input: CreateUserWorkspaceInput): Promise<{ user: UserRecord; workspace: WorkspaceRecord }>;
  updateWorkspace(workspaceId: string, patch: Partial<WorkspaceRecord>): Promise<WorkspaceRecord | null>;
  listMonitors(workspaceId: string): Promise<MonitorRecord[]>;
  listAllActiveMonitors(): Promise<Array<{ monitor: MonitorRecord; workspace: WorkspaceRecord }>>;
  getMonitor(workspaceId: string, monitorId: string): Promise<MonitorRecord | null>;
  createMonitor(input: CreateMonitorInput): Promise<MonitorRecord>;
  updateMonitor(workspaceId: string, monitorId: string, patch: Partial<MonitorRecord>): Promise<MonitorRecord | null>;
  deleteMonitor(workspaceId: string, monitorId: string): Promise<boolean>;
  hasLeadExternalId(monitorId: string, channel: Channel, externalId: string): Promise<boolean>;
  insertLead(input: InsertLeadInput): Promise<LeadRecord | null>;
  listLeads(
    workspaceId: string,
    opts?: {
      channel?: Channel | "all";
      status?: LeadStatus | "all";
      includeNoise?: boolean;
      onlyNoise?: boolean;
      limit?: number;
    },
  ): Promise<LeadRecord[]>;
  getLead(workspaceId: string, leadId: string): Promise<LeadRecord | null>;
  updateLead(workspaceId: string, leadId: string, patch: Partial<LeadRecord>): Promise<LeadRecord | null>;
  insertScanRun(input: Omit<ScanRunRecord, "id" | "createdAt">): Promise<ScanRunRecord>;
  listScanRuns(workspaceId: string, limit?: number): Promise<ScanRunRecord[]>;
  insertBillingEvent(input: Omit<BillingEventRecord, "id" | "createdAt">): Promise<BillingEventRecord>;
  listBillingEvents(workspaceId: string): Promise<BillingEventRecord[]>;
  getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats>;
}

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

function safeIsoDate(val: unknown): string {
  const date = new Date(String(val ?? ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function mapUserRow(r: Record<string, unknown>): UserRecord {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    passwordHash: String(r.password_hash),
    companyName: String(r.company_name ?? ""),
    createdAt: safeIsoDate(r.created_at),
  };
}

function mapWorkspaceRow(r: Record<string, unknown>): WorkspaceRecord {
  return {
    id: String(r.id),
    ownerUserId: String(r.owner_user_id),
    name: String(r.name),
    productName: String(r.product_name ?? ""),
    productDescription: String(r.product_description ?? ""),
    productUrl: String(r.product_url ?? ""),
    idealCustomer: String(r.ideal_customer ?? ""),
    defaultTone: (r.default_tone as ReplyTone) || "founder",
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
    createdAt: safeIsoDate(r.created_at),
  };
}

function mapMonitorRow(r: Record<string, unknown>): MonitorRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    name: String(r.name),
    keywords: parseJsonField<string[]>(r.keywords, []),
    competitors: parseJsonField<string[]>(r.competitors, []),
    negativeKeywords: parseJsonField<string[]>(r.negative_keywords, []),
    channels: parseJsonField<Channel[]>(r.channels, ["reddit", "x", "linkedin", "hackernews"]),
    minConfidence: Number(r.min_confidence ?? 70),
    isActive: Boolean(r.is_active),
    lastScannedAt: r.last_scanned_at ? safeIsoDate(r.last_scanned_at) : null,
    createdAt: safeIsoDate(r.created_at),
  };
}

function mapLeadRow(r: Record<string, unknown>): LeadRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    monitorId: String(r.monitor_id),
    channel: r.channel as Channel,
    externalId: String(r.external_id),
    author: String(r.author),
    authorHandle: String(r.author_handle ?? ""),
    title: String(r.title ?? ""),
    body: String(r.body),
    url: String(r.url),
    community: String(r.community ?? ""),
    intentType: r.intent_type as IntentType,
    confidenceScore: Number(r.confidence_score),
    buyingUrgency: (r.buying_urgency as BuyingUrgency) || "medium",
    reasoning: String(r.reasoning),
    painPoints: parseJsonField<string[]>(r.pain_points, []),
    isFilteredNoise: Boolean(r.is_filtered_noise),
    replyHook: String(r.reply_hook ?? ""),
    replyValuePoints: parseJsonField<string[]>(r.reply_value_points, []),
    replySoftMention: String(r.reply_soft_mention ?? ""),
    replyDraft: String(r.reply_draft ?? ""),
    replyTone: (r.reply_tone as ReplyTone) || "founder",
    status: (r.status as LeadStatus) || "new",
    alertSentSlack: Boolean(r.alert_sent_slack),
    alertSentDiscord: Boolean(r.alert_sent_discord),
    sourceMode: (r.source_mode as SourceMode) || "live",
    publishedAt: safeIsoDate(r.published_at),
    createdAt: safeIsoDate(r.created_at),
  };
}

function mapScanRunRow(r: Record<string, unknown>): ScanRunRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    monitorId: r.monitor_id ? String(r.monitor_id) : null,
    triggerType: r.trigger_type as ScanRunRecord["triggerType"],
    postsFetched: Number(r.posts_fetched ?? 0),
    stage1Dropped: Number(r.stage1_dropped ?? 0),
    llmFilteredNoise: Number(r.llm_filtered_noise ?? 0),
    highIntentMatched: Number(r.high_intent_matched ?? 0),
    alertsDispatched: Number(r.alerts_dispatched ?? 0),
    channelStatuses: parseJsonField<Record<string, ChannelFetchStatus>>(r.channel_statuses, {}),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

function mapBillingRow(r: Record<string, unknown>): BillingEventRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    eventType: String(r.event_type),
    amountCents: Number(r.amount_cents ?? 0),
    description: String(r.description),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

let singletonPgClient: ReturnType<typeof getDatabase> | null = null;
function getSharedPgClient(): ReturnType<typeof getDatabase> {
  if (!singletonPgClient) {
    singletonPgClient = getDatabase();
  }
  return singletonPgClient;
}

export class PostgresDb implements SignalScoutDb {
  private readonly db = getSharedPgClient();

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.db.sql`SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
    return rows[0] ? mapUserRow(rows[0] as Record<string, unknown>) : null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const rows = await this.db.sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
    return rows[0] ? mapUserRow(rows[0] as Record<string, unknown>) : null;
  }

  async getWorkspaceById(workspaceId: string): Promise<WorkspaceRecord | null> {
    const rows = await this.db.sql`SELECT * FROM workspaces WHERE id = ${workspaceId} LIMIT 1`;
    return rows[0] ? mapWorkspaceRow(rows[0] as Record<string, unknown>) : null;
  }

  async getWorkspaceByOwner(userId: string): Promise<WorkspaceRecord | null> {
    const rows = await this.db.sql`SELECT * FROM workspaces WHERE owner_user_id = ${userId} LIMIT 1`;
    return rows[0] ? mapWorkspaceRow(rows[0] as Record<string, unknown>) : null;
  }

  async getWorkspaceByIngestSecret(secret: string): Promise<WorkspaceRecord | null> {
    const rows = await this.db.sql`SELECT * FROM workspaces WHERE ingest_secret = ${secret} LIMIT 1`;
    return rows[0] ? mapWorkspaceRow(rows[0] as Record<string, unknown>) : null;
  }

  async createUserWithWorkspace(
    input: CreateUserWorkspaceInput,
  ): Promise<{ user: UserRecord; workspace: WorkspaceRecord }> {
    const userId = `usr_${randomUUID().slice(0, 12)}`;
    const workspaceId = `ws_${randomUUID().slice(0, 12)}`;
    const ingestSecret = `ss_wh_${randomBytes(16).toString("hex")}`;
    const trialEndsAt = new Date().toISOString();

    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");
      const userRes = await client.query(
        `INSERT INTO users (id, email, name, password_hash, company_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, input.email.trim().toLowerCase(), input.name.trim(), input.passwordHash, input.companyName?.trim() ?? ""],
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
          ingestSecret,
        ],
      );
      await client.query("COMMIT");
      return {
        user: mapUserRow(userRes.rows[0]),
        workspace: mapWorkspaceRow(wsRes.rows[0]),
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async updateWorkspace(workspaceId: string, patch: Partial<WorkspaceRecord>): Promise<WorkspaceRecord | null> {
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
    return rows[0] ? mapWorkspaceRow(rows[0] as Record<string, unknown>) : null;
  }

  async listMonitors(workspaceId: string): Promise<MonitorRecord[]> {
    const rows = await this.db.sql`
      SELECT * FROM monitors WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC`;
    return rows.map((r) => mapMonitorRow(r as Record<string, unknown>));
  }

  async listAllActiveMonitors(): Promise<Array<{ monitor: MonitorRecord; workspace: WorkspaceRecord }>> {
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
      const r = row as Record<string, unknown>;
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
          created_at: r.w_created_at,
        }),
      };
    });
  }

  async getMonitor(workspaceId: string, monitorId: string): Promise<MonitorRecord | null> {
    const rows = await this.db.sql`
      SELECT * FROM monitors WHERE id = ${monitorId} AND workspace_id = ${workspaceId} LIMIT 1`;
    return rows[0] ? mapMonitorRow(rows[0] as Record<string, unknown>) : null;
  }

  async createMonitor(input: CreateMonitorInput): Promise<MonitorRecord> {
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
    return mapMonitorRow(rows[0] as Record<string, unknown>);
  }

  async updateMonitor(
    workspaceId: string,
    monitorId: string,
    patch: Partial<MonitorRecord>,
  ): Promise<MonitorRecord | null> {
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
    return rows[0] ? mapMonitorRow(rows[0] as Record<string, unknown>) : null;
  }

  async deleteMonitor(workspaceId: string, monitorId: string): Promise<boolean> {
    const rows = await this.db.sql`
      DELETE FROM monitors WHERE id = ${monitorId} AND workspace_id = ${workspaceId} RETURNING id`;
    return rows.length > 0;
  }

  async hasLeadExternalId(monitorId: string, channel: Channel, externalId: string): Promise<boolean> {
    const rows = await this.db.sql`
      SELECT 1 FROM leads WHERE monitor_id = ${monitorId} AND channel = ${channel} AND external_id = ${externalId} LIMIT 1`;
    return rows.length > 0;
  }

  async insertLead(input: InsertLeadInput): Promise<LeadRecord | null> {
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
    return rows[0] ? mapLeadRow(rows[0] as Record<string, unknown>) : null;
  }

  async listLeads(
    workspaceId: string,
    opts: {
      channel?: Channel | "all";
      status?: LeadStatus | "all";
      includeNoise?: boolean;
      onlyNoise?: boolean;
      limit?: number;
    } = {},
  ): Promise<LeadRecord[]> {
    const limit = opts.limit ?? 100;
    const rows = await this.db.sql`
      SELECT * FROM leads WHERE workspace_id = ${workspaceId} ORDER BY published_at DESC, created_at DESC LIMIT 300`;
    let items = rows.map((r) => mapLeadRow(r as Record<string, unknown>));
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

  async getLead(workspaceId: string, leadId: string): Promise<LeadRecord | null> {
    const rows = await this.db.sql`
      SELECT * FROM leads WHERE id = ${leadId} AND workspace_id = ${workspaceId} LIMIT 1`;
    return rows[0] ? mapLeadRow(rows[0] as Record<string, unknown>) : null;
  }

  async updateLead(workspaceId: string, leadId: string, patch: Partial<LeadRecord>): Promise<LeadRecord | null> {
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
    return rows[0] ? mapLeadRow(rows[0] as Record<string, unknown>) : null;
  }

  async insertScanRun(input: Omit<ScanRunRecord, "id" | "createdAt">): Promise<ScanRunRecord> {
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
    return mapScanRunRow(rows[0] as Record<string, unknown>);
  }

  async listScanRuns(workspaceId: string, limit: number = 20): Promise<ScanRunRecord[]> {
    const rows = await this.db.sql`
      SELECT * FROM scan_runs WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map((r) => mapScanRunRow(r as Record<string, unknown>));
  }

  async insertBillingEvent(input: Omit<BillingEventRecord, "id" | "createdAt">): Promise<BillingEventRecord> {
    const id = `bil_${randomUUID().slice(0, 12)}`;
    const rows = await this.db.sql`
      INSERT INTO billing_events (id, workspace_id, event_type, amount_cents, description)
      VALUES (${id}, ${input.workspaceId}, ${input.eventType}, ${input.amountCents}, ${input.description})
      RETURNING *`;
    return mapBillingRow(rows[0] as Record<string, unknown>);
  }

  async listBillingEvents(workspaceId: string): Promise<BillingEventRecord[]> {
    const rows = await this.db.sql`
      SELECT * FROM billing_events WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT 30`;
    return rows.map((r) => mapBillingRow(r as Record<string, unknown>));
  }

  async getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
    const leads = await this.listLeads(workspaceId, { includeNoise: true, limit: 300 });
    const monitors = await this.listMonitors(workspaceId);
    const runs = await this.listScanRuns(workspaceId, 50);

    const highIntent = leads.filter((l) => !l.isFilteredNoise);
    const noiseBlocked =
      leads.filter((l) => l.isFilteredNoise).length +
      runs.reduce((sum, r) => sum + r.stage1Dropped, 0);

    const avgConfidence =
      highIntent.length > 0
        ? Math.round(highIntent.reduce((sum, l) => sum + l.confidenceScore, 0) / highIntent.length)
        : 0;

    return {
      totalLeads: highIntent.length,
      newLeads: highIntent.filter((l) => l.status === "new").length,
      repliedLeads: highIntent.filter((l) => l.status === "replied").length,
      noiseBlocked,
      alertsSent: highIntent.filter((l) => l.alertSentSlack || l.alertSentDiscord).length,
      activeMonitors: monitors.filter((m) => m.isActive).length,
      avgConfidence,
    };
  }
}

export class MemoryDb implements SignalScoutDb {
  users = new Map<string, UserRecord>();
  workspaces = new Map<string, WorkspaceRecord>();
  monitors = new Map<string, MonitorRecord>();
  leads = new Map<string, LeadRecord>();
  scanRuns: ScanRunRecord[] = [];
  billingEvents: BillingEventRecord[] = [];

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const target = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === target) return user;
    }
    return null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async getWorkspaceById(workspaceId: string): Promise<WorkspaceRecord | null> {
    return this.workspaces.get(workspaceId) ?? null;
  }

  async getWorkspaceByOwner(userId: string): Promise<WorkspaceRecord | null> {
    for (const ws of this.workspaces.values()) {
      if (ws.ownerUserId === userId) return ws;
    }
    return null;
  }

  async getWorkspaceByIngestSecret(secret: string): Promise<WorkspaceRecord | null> {
    for (const ws of this.workspaces.values()) {
      if (ws.ingestSecret === secret) return ws;
    }
    return null;
  }

  async createUserWithWorkspace(
    input: CreateUserWorkspaceInput,
  ): Promise<{ user: UserRecord; workspace: WorkspaceRecord }> {
    const now = new Date().toISOString();
    const user: UserRecord = {
      id: `usr_${randomUUID().slice(0, 12)}`,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      companyName: input.companyName?.trim() ?? "",
      createdAt: now,
    };
    const workspace: WorkspaceRecord = {
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
      createdAt: now,
    };
    this.users.set(user.id, user);
    this.workspaces.set(workspace.id, workspace);
    return { user, workspace };
  }

  async updateWorkspace(workspaceId: string, patch: Partial<WorkspaceRecord>): Promise<WorkspaceRecord | null> {
    const existing = this.workspaces.get(workspaceId);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.workspaces.set(workspaceId, updated);
    return updated;
  }

  async listMonitors(workspaceId: string): Promise<MonitorRecord[]> {
    return Array.from(this.monitors.values())
      .filter((m) => m.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAllActiveMonitors(): Promise<Array<{ monitor: MonitorRecord; workspace: WorkspaceRecord }>> {
    const out: Array<{ monitor: MonitorRecord; workspace: WorkspaceRecord }> = [];
    for (const m of this.monitors.values()) {
      if (!m.isActive) continue;
      const ws = this.workspaces.get(m.workspaceId);
      if (ws) {
        out.push({ monitor: m, workspace: ws });
      }
    }
    return out;
  }

  async getMonitor(workspaceId: string, monitorId: string): Promise<MonitorRecord | null> {
    const m = this.monitors.get(monitorId);
    return m && m.workspaceId === workspaceId ? m : null;
  }

  async createMonitor(input: CreateMonitorInput): Promise<MonitorRecord> {
    const monitor: MonitorRecord = {
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
      createdAt: new Date().toISOString(),
    };
    this.monitors.set(monitor.id, monitor);
    return monitor;
  }

  async updateMonitor(
    workspaceId: string,
    monitorId: string,
    patch: Partial<MonitorRecord>,
  ): Promise<MonitorRecord | null> {
    const existing = await this.getMonitor(workspaceId, monitorId);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.monitors.set(monitorId, updated);
    return updated;
  }

  async deleteMonitor(workspaceId: string, monitorId: string): Promise<boolean> {
    const existing = await this.getMonitor(workspaceId, monitorId);
    if (!existing) return false;
    return this.monitors.delete(monitorId);
  }

  async hasLeadExternalId(monitorId: string, channel: Channel, externalId: string): Promise<boolean> {
    for (const l of this.leads.values()) {
      if (l.monitorId === monitorId && l.channel === channel && l.externalId === externalId) return true;
    }
    return false;
  }

  async insertLead(input: InsertLeadInput): Promise<LeadRecord | null> {
    if (await this.hasLeadExternalId(input.monitorId, input.channel, input.externalId)) {
      return null;
    }
    const lead: LeadRecord = {
      id: `lead_${randomUUID().slice(0, 12)}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  async listLeads(
    workspaceId: string,
    opts: {
      channel?: Channel | "all";
      status?: LeadStatus | "all";
      includeNoise?: boolean;
      onlyNoise?: boolean;
      limit?: number;
    } = {},
  ): Promise<LeadRecord[]> {
    let items = Array.from(this.leads.values())
      .filter((l) => l.workspaceId === workspaceId)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.createdAt.localeCompare(a.createdAt));

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

  async getLead(workspaceId: string, leadId: string): Promise<LeadRecord | null> {
    const l = this.leads.get(leadId);
    return l && l.workspaceId === workspaceId ? l : null;
  }

  async updateLead(workspaceId: string, leadId: string, patch: Partial<LeadRecord>): Promise<LeadRecord | null> {
    const existing = await this.getLead(workspaceId, leadId);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.leads.set(leadId, updated);
    return updated;
  }

  async insertScanRun(input: Omit<ScanRunRecord, "id" | "createdAt">): Promise<ScanRunRecord> {
    const run: ScanRunRecord = {
      id: `run_${randomUUID().slice(0, 12)}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.scanRuns.unshift(run);
    return run;
  }

  async listScanRuns(workspaceId: string, limit: number = 20): Promise<ScanRunRecord[]> {
    return this.scanRuns.filter((r) => r.workspaceId === workspaceId).slice(0, limit);
  }

  async insertBillingEvent(input: Omit<BillingEventRecord, "id" | "createdAt">): Promise<BillingEventRecord> {
    const ev: BillingEventRecord = {
      id: `bil_${randomUUID().slice(0, 12)}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.billingEvents.unshift(ev);
    return ev;
  }

  async listBillingEvents(workspaceId: string): Promise<BillingEventRecord[]> {
    return this.billingEvents.filter((b) => b.workspaceId === workspaceId);
  }

  async getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
    const leads = await this.listLeads(workspaceId, { includeNoise: true, limit: 300 });
    const monitors = await this.listMonitors(workspaceId);
    const runs = await this.listScanRuns(workspaceId, 50);

    const highIntent = leads.filter((l) => !l.isFilteredNoise);
    const noiseBlocked =
      leads.filter((l) => l.isFilteredNoise).length + runs.reduce((sum, r) => sum + r.stage1Dropped, 0);
    const avgConfidence =
      highIntent.length > 0
        ? Math.round(highIntent.reduce((sum, l) => sum + l.confidenceScore, 0) / highIntent.length)
        : 0;

    return {
      totalLeads: highIntent.length,
      newLeads: highIntent.filter((l) => l.status === "new").length,
      repliedLeads: highIntent.filter((l) => l.status === "replied").length,
      noiseBlocked,
      alertsSent: highIntent.filter((l) => l.alertSentSlack || l.alertSentDiscord).length,
      activeMonitors: monitors.filter((m) => m.isActive).length,
      avgConfidence,
    };
  }
}

let cachedMemoryDb: MemoryDb | null = null;
let cachedPostgresDb: PostgresDb | null = null;

export function getDb(): SignalScoutDb {
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

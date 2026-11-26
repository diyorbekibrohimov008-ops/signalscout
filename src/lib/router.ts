import {
  buildClearSessionCookie,
  buildSessionCookie,
  hashPassword,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from "./auth";
import { getFreePlanStatus } from "./billing";
import type { SignalScoutDb } from "./db";
import { getEnv } from "./env";
import { classifyIntent, runStage1Filter } from "./intent";
import { buildSlackPayload, dispatchWebhookAlerts, isSafeWebhookEndpoint } from "./notifier";
import { processCandidatePosts, regenerateLeadReply, runMonitorScan } from "./pipeline";
import { generateReplyOutline } from "./reply";
import { ensureDemoWorkspace } from "./seed";
import type {
  Channel,
  LeadRecord,
  LeadStatus,
  MonitorRecord,
  RawSocialPost,
  ReplyTone,
  WorkspaceRecord,
} from "./types";

function json(data: unknown, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function sanitizeWorkspace(ws: WorkspaceRecord) {
  return {
    id: ws.id,
    name: ws.name,
    productName: ws.productName,
    productDescription: ws.productDescription,
    productUrl: ws.productUrl,
    idealCustomer: ws.idealCustomer,
    defaultTone: ws.defaultTone,
    plan: "free" as const,
    slackWebhookUrl: ws.slackWebhookUrl,
    discordWebhookUrl: ws.discordWebhookUrl,
    ingestSecret: ws.ingestSecret,
    customOpenaiKeySet: Boolean(ws.customOpenaiKey),
    xBearerTokenSet: Boolean(ws.xBearerToken),
    apifyTokenSet: Boolean(ws.apifyToken),
    createdAt: ws.createdAt,
  };
}

async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    const parsed: unknown = await req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

async function requireAuth(req: Request, db: SignalScoutDb) {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const user = await db.getUserById(session.userId);
  const workspace = await db.getWorkspaceById(session.workspaceId);
  if (!user || !workspace) return null;
  return { user, workspace };
}

function asTrimmedString(val: unknown): string {
  return typeof val === "string" ? val.trim() : "";
}

function parseTerms(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
      .map((v) => String(v).trim())
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseConfidence(input: unknown, fallback: number = 70): number {
  const num = Number(input);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(40, Math.min(98, Math.round(num)));
}

function parseIsoTimestamp(input: unknown): string {
  if (typeof input === "string" && input.trim()) {
    const ms = Date.parse(input);
    if (Number.isFinite(ms)) {
      return new Date(ms).toISOString();
    }
  }
  return new Date().toISOString();
}

function parseSafeExternalUrl(input: unknown, fallback: string): string {
  const raw = asTrimmedString(input);
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // Fall back to safe URL
  }
  return fallback;
}

const ALLOWED_CHANNELS: Channel[] = ["reddit", "x", "linkedin", "hackernews"];
const ALLOWED_STATUSES: LeadStatus[] = ["new", "replied", "dismissed"];
const ALLOWED_TONES: ReplyTone[] = ["founder", "peer", "technical"];

function parseChannels(input: unknown): Channel[] {
  if (!Array.isArray(input)) return [...ALLOWED_CHANNELS];
  const filtered = input.filter((c): c is Channel => ALLOWED_CHANNELS.includes(c as Channel));
  return filtered.length > 0 ? filtered : [...ALLOWED_CHANNELS];
}

function parseTone(input: unknown, fallback: ReplyTone = "founder"): ReplyTone {
  return typeof input === "string" && ALLOWED_TONES.includes(input as ReplyTone)
    ? (input as ReplyTone)
    : fallback;
}

export async function handleApiRequest(
  req: Request,
  db: SignalScoutDb,
  opts: { fetchFn?: typeof fetch } = {},
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method.toUpperCase();
  const fetchFn = opts.fetchFn ?? fetch;

  try {
    // 1. Health check
    if (method === "GET" && path === "/api/health") {
      return json({
        ok: true,
        service: "SignalScout",
        free: true,
        database: getEnv("NETLIFY_DB_URL") || getEnv("DATABASE_URL") ? "postgres" : "memory",
        aiGatewayActive: Boolean(getEnv("OPENAI_BASE_URL") || getEnv("OPENAI_API_KEY")),
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Public interactive intent-filter & Slack preview evaluator
    if (method === "POST" && path === "/api/demo/evaluate") {
      const body = await readJsonBody<{
        channel?: Channel;
        title?: string;
        body?: string;
        authorHandle?: string;
        keywords?: string[] | string;
        competitors?: string[] | string;
        negativeKeywords?: string[] | string;
        productName?: string;
        productDescription?: string;
        tone?: ReplyTone;
      }>(req);

      const postTitle = asTrimmedString(body?.title);
      const postBody = asTrimmedString(body?.body);
      if (!body || (!postBody && !postTitle)) {
        return json({ error: "Enter a post title or body to evaluate." }, 400);
      }

      const channel: Channel = ALLOWED_CHANNELS.includes(body.channel as Channel)
        ? (body.channel as Channel)
        : "reddit";
      const handle = asTrimmedString(body.authorHandle) || (channel === "x" ? "@prospect" : "u/prospect");
      const tone = parseTone(body.tone, "founder");

      const post: RawSocialPost = {
        channel,
        externalId: `playground_${Date.now()}`,
        author: "prospect",
        authorHandle: handle,
        title: postTitle,
        body: postBody,
        url:
          channel === "hackernews"
            ? "https://news.ycombinator.com/item?id=42000"
            : channel === "x"
              ? "https://x.com/prospect/status/185500000"
              : channel === "linkedin"
                ? "https://www.linkedin.com/feed/"
                : "https://www.reddit.com/r/SaaS/",
        community: channel === "reddit" ? "r/SaaS" : channel === "hackernews" ? "Ask HN" : channel.toUpperCase(),
        publishedAt: new Date().toISOString(),
        sourceMode: "simulation",
      };

      const parsedKeywords = parseTerms(body.keywords);
      const parsedCompetitors = parseTerms(body.competitors);

      const tempMonitor: MonitorRecord = {
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
        createdAt: new Date().toISOString(),
      };

      const tempWorkspace: WorkspaceRecord = {
        id: "ws_playground",
        ownerUserId: "usr_playground",
        name: "Preview",
        productName: asTrimmedString(body.productName) || "SignalScout",
        productDescription:
          asTrimmedString(body.productDescription) ||
          "Free buying-intent listening across Reddit, X, LinkedIn, and Hacker News with noise filtering and ready-to-edit reply drafts.",
        productUrl: "https://signalscout.app",
        idealCustomer: "SaaS founders",
        defaultTone: tone,
        plan: "free",
        trialEndsAt: new Date().toISOString(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        slackWebhookUrl: "",
        discordWebhookUrl: "",
        customOpenaiKey: "",
        xBearerToken: "",
        apifyToken: "",
        ingestSecret: "playground",
        createdAt: new Date().toISOString(),
      };

      const stage1 = runStage1Filter(post, tempMonitor);
      const analysis = stage1.passed
        ? await classifyIntent(post, tempMonitor, tempWorkspace)
        : {
            intentType: "noise_or_irrelevant" as const,
            confidenceScore: 10,
            buyingUrgency: "low" as const,
            reasoning: `Dropped in Stage 1 pre-filter (${stage1.reason}) — zero LLM tokens spent.`,
            painPoints: [],
            shouldAlert: false,
            classifierMode: "heuristic" as const,
          };

      const reply = generateReplyOutline(post, analysis, tempWorkspace, tone);
      const previewLead: LeadRecord = {
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
        createdAt: new Date().toISOString(),
      };

      return json({
        stage1,
        analysis,
        reply,
        slackPayload: buildSlackPayload(previewLead, tempMonitor),
      });
    }

    // 3. Auth endpoints
    if (method === "POST" && path === "/api/auth/register") {
      const body = await readJsonBody<{
        email?: unknown;
        name?: unknown;
        password?: unknown;
        companyName?: unknown;
        productName?: unknown;
        productDescription?: unknown;
      }>(req);

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
      const { user, workspace } = await db.createUserWithWorkspace({
        email,
        name,
        passwordHash,
        companyName: companyName || undefined,
        productName: productName || companyName || "My Product",
        productDescription: productDescription || undefined,
        plan: "free",
      });

      const token = await signSessionToken({ userId: user.id, workspaceId: workspace.id, email: user.email });
      return json(
        { user: { id: user.id, email: user.email, name: user.name }, workspace: sanitizeWorkspace(workspace) },
        201,
        { "Set-Cookie": buildSessionCookie(token) },
      );
    }

    if (method === "POST" && path === "/api/auth/login") {
      const body = await readJsonBody<{ email?: unknown; password?: unknown }>(req);
      const email = asTrimmedString(body?.email);
      const password = typeof body?.password === "string" ? body.password : "";

      if (!email || !password) {
        return json({ error: "Email and password are required." }, 400);
      }
      const user = await db.findUserByEmail(email);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return json({ error: "Invalid email or password." }, 401);
      }
      const workspace = await db.getWorkspaceByOwner(user.id);
      if (!workspace) {
        return json({ error: "Workspace not found." }, 404);
      }
      const token = await signSessionToken({ userId: user.id, workspaceId: workspace.id, email: user.email });
      return json(
        { user: { id: user.id, email: user.email, name: user.name }, workspace: sanitizeWorkspace(workspace) },
        200,
        { "Set-Cookie": buildSessionCookie(token) },
      );
    }

    if (method === "POST" && path === "/api/auth/demo") {
      const { user, workspace } = await ensureDemoWorkspace(db);
      const token = await signSessionToken({ userId: user.id, workspaceId: workspace.id, email: user.email });
      return json(
        { user: { id: user.id, email: user.email, name: user.name }, workspace: sanitizeWorkspace(workspace) },
        200,
        { "Set-Cookie": buildSessionCookie(token) },
      );
    }

    if (method === "POST" && path === "/api/auth/logout") {
      return json({ ok: true }, 200, { "Set-Cookie": buildClearSessionCookie() });
    }

    // 4. External Webhook Bridge Ingest (for X, LinkedIn, Zapier, Apify, n8n)
    if (method === "POST" && path === "/api/ingest/webhook") {
      const secret = url.searchParams.get("secret") || req.headers.get("x-signalscout-secret") || "";
      if (!secret) {
        return json({ error: "Missing webhook ingest secret." }, 401);
      }
      const workspace = await db.getWorkspaceByIngestSecret(secret);
      if (!workspace) {
        return json({ error: "Invalid webhook ingest secret." }, 401);
      }

      const body = await readJsonBody<{
        monitorId?: unknown;
        posts?: unknown;
      }>(req);

      if (!body || !Array.isArray(body.posts)) {
        return json({ error: "Request body must include a posts array." }, 400);
      }

      const monitors = await db.listMonitors(workspace.id);
      const requestedMonitorId = asTrimmedString(body.monitorId);
      const targetMonitor =
        (requestedMonitorId ? monitors.find((m) => m.id === requestedMonitorId) : monitors.find((m) => m.isActive)) ??
        monitors[0];
      if (!targetMonitor) {
        return json({ error: "Create a topic to watch before sending posts via webhook." }, 400);
      }

      const rawPosts: RawSocialPost[] = [];
      for (let idx = 0; idx < body.posts.length; idx++) {
        const entry = body.posts[idx];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const p = entry as Record<string, unknown>;
        const postBody = asTrimmedString(p.body);
        if (!postBody) continue;

        const ch: Channel = ALLOWED_CHANNELS.includes(p.channel as Channel) ? (p.channel as Channel) : "x";
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
          sourceMode: "webhook",
        });
      }

      if (rawPosts.length === 0) {
        return json({ error: "Provide at least one post with non-empty body text." }, 400);
      }

      const scanRun = await processCandidatePosts(
        db,
        workspace,
        targetMonitor,
        rawPosts,
        {
          webhook: {
            channel: rawPosts[0].channel,
            status: "live",
            fetched: rawPosts.length,
            note: `Ingested ${rawPosts.length} post(s) via webhook bridge`,
          },
        },
        { triggerType: "webhook", fetchFn },
      );

      return json({ ok: true, scanRun });
    }

    // All endpoints below require authenticated session
    const auth = await requireAuth(req, db);
    if (!auth) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { user, workspace } = auth;

    if (method === "GET" && path === "/api/auth/me") {
      const [stats, monitors, scanRuns] = await Promise.all([
        db.getWorkspaceStats(workspace.id),
        db.listMonitors(workspace.id),
        db.listScanRuns(workspace.id, 10),
      ]);
      return json({
        user: { id: user.id, email: user.email, name: user.name, companyName: user.companyName },
        workspace: sanitizeWorkspace(workspace),
        stats,
        monitors,
        scanRuns,
      });
    }

    // Monitors (Topics to watch) CRUD
    if (method === "GET" && path === "/api/monitors") {
      const monitors = await db.listMonitors(workspace.id);
      return json({ monitors });
    }

    if (method === "POST" && path === "/api/monitors") {
      const body = await readJsonBody<{
        name?: unknown;
        keywords?: unknown;
        competitors?: unknown;
        negativeKeywords?: unknown;
        channels?: unknown;
        minConfidence?: unknown;
      }>(req);

      const name = asTrimmedString(body?.name);
      const keywords = parseTerms(body?.keywords);
      const competitors = parseTerms(body?.competitors);
      if (!name || (keywords.length === 0 && competitors.length === 0)) {
        return json({ error: "Give this topic a name and at least one keyword or competitor." }, 400);
      }

      const monitor = await db.createMonitor({
        workspaceId: workspace.id,
        name,
        keywords,
        competitors,
        negativeKeywords: parseTerms(body?.negativeKeywords),
        channels: parseChannels(body?.channels),
        minConfidence: parseConfidence(body?.minConfidence, 70),
      });
      return json({ monitor }, 201);
    }

    const monitorMatch = path.match(/^\/api\/monitors\/([^/]+)$/);
    if (monitorMatch) {
      const monitorId = decodeURIComponent(monitorMatch[1]);
      if (method === "PATCH") {
        const body = await readJsonBody<{
          name?: unknown;
          keywords?: unknown;
          competitors?: unknown;
          negativeKeywords?: unknown;
          channels?: unknown;
          minConfidence?: unknown;
          isActive?: unknown;
        }>(req);
        if (!body) return json({ error: "Invalid JSON body." }, 400);

        const patch: Partial<MonitorRecord> = {};
        if (body.name !== undefined) {
          const trimmed = asTrimmedString(body.name);
          if (!trimmed) return json({ error: "Topic name cannot be empty." }, 400);
          patch.name = trimmed;
        }
        if (body.keywords !== undefined) patch.keywords = parseTerms(body.keywords);
        if (body.competitors !== undefined) patch.competitors = parseTerms(body.competitors);
        if (body.negativeKeywords !== undefined) patch.negativeKeywords = parseTerms(body.negativeKeywords);
        if (body.channels !== undefined) patch.channels = parseChannels(body.channels);
        if (body.minConfidence !== undefined) patch.minConfidence = parseConfidence(body.minConfidence, 70);
        if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);

        const updated = await db.updateMonitor(workspace.id, monitorId, patch);
        return updated ? json({ monitor: updated }) : json({ error: "Topic not found." }, 404);
      }

      if (method === "DELETE") {
        const deleted = await db.deleteMonitor(workspace.id, monitorId);
        return deleted ? json({ ok: true }) : json({ error: "Topic not found." }, 404);
      }
    }

    // Leads & Filtered Out Audit
    if (method === "GET" && path === "/api/leads") {
      const rawChannel = url.searchParams.get("channel") || "all";
      const channel: Channel | "all" = ALLOWED_CHANNELS.includes(rawChannel as Channel)
        ? (rawChannel as Channel)
        : "all";
      const rawStatus = url.searchParams.get("status") || "all";
      const status: LeadStatus | "all" = ALLOWED_STATUSES.includes(rawStatus as LeadStatus)
        ? (rawStatus as LeadStatus)
        : "all";
      const filter = url.searchParams.get("filter") || "intent";

      const [leads, noise, stats] = await Promise.all([
        db.listLeads(workspace.id, { channel, status, includeNoise: false }),
        filter === "all" || filter === "noise"
          ? db.listLeads(workspace.id, { channel, onlyNoise: true })
          : Promise.resolve([]),
        db.getWorkspaceStats(workspace.id),
      ]);

      return json({ leads, noise, stats });
    }

    const leadRegenMatch = path.match(/^\/api\/leads\/([^/]+)\/regenerate-reply$/);
    if (leadRegenMatch && method === "POST") {
      const lead = await db.getLead(workspace.id, decodeURIComponent(leadRegenMatch[1]));
      if (!lead) return json({ error: "Lead not found." }, 404);
      const body = await readJsonBody<{ tone?: unknown }>(req);
      const tone = parseTone(body?.tone, workspace.defaultTone);
      const updated = await regenerateLeadReply(db, workspace, lead, tone);
      return json({ lead: updated });
    }

    const leadSlackMatch = path.match(/^\/api\/leads\/([^/]+)\/send-slack$/);
    if (leadSlackMatch && method === "POST") {
      const lead = await db.getLead(workspace.id, decodeURIComponent(leadSlackMatch[1]));
      if (!lead) return json({ error: "Lead not found." }, 404);
      const monitor: MonitorRecord = (await db.getMonitor(workspace.id, lead.monitorId)) ?? {
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
        createdAt: lead.createdAt,
      };
      if (!workspace.slackWebhookUrl && !workspace.discordWebhookUrl) {
        return json({ error: "Add a Slack or Discord webhook URL in Notifications first." }, 400);
      }
      const dispatch = await dispatchWebhookAlerts(lead, monitor, workspace, fetchFn);
      const updated = await db.updateLead(workspace.id, lead.id, {
        alertSentSlack: lead.alertSentSlack || dispatch.slackSent,
        alertSentDiscord: lead.alertSentDiscord || dispatch.discordSent,
      });
      return json({ lead: updated, dispatch });
    }

    const leadMatch = path.match(/^\/api\/leads\/([^/]+)$/);
    if (leadMatch && method === "PATCH") {
      const body = await readJsonBody<{ status?: unknown; replyDraft?: unknown }>(req);
      if (!body) return json({ error: "Invalid JSON body." }, 400);
      const patch: Partial<LeadRecord> = {};
      if (typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status as LeadStatus)) {
        patch.status = body.status as LeadStatus;
      }
      if (typeof body.replyDraft === "string") {
        patch.replyDraft = body.replyDraft;
      }
      const updated = await db.updateLead(workspace.id, decodeURIComponent(leadMatch[1]), patch);
      return updated ? json({ lead: updated }) : json({ error: "Lead not found." }, 404);
    }

    // On-demand scan
    if (method === "POST" && path === "/api/scan") {
      const body = await readJsonBody<{ monitorId?: unknown; includeSimulation?: unknown }>(req);
      const monitors = await db.listMonitors(workspace.id);
      const requestedId = asTrimmedString(body?.monitorId);
      const targets = requestedId
        ? monitors.filter((m) => m.id === requestedId)
        : monitors.filter((m) => m.isActive);

      if (targets.length === 0) {
        return json({ error: "No active topics to scan. Add or resume a topic first." }, 400);
      }

      const runs = [];
      for (const mon of targets.slice(0, 5)) {
        const run = await runMonitorScan(db, workspace, mon, {
          triggerType: "manual",
          includeSimulation: typeof body?.includeSimulation === "boolean" ? body.includeSimulation : true,
          fetchFn,
        });
        runs.push(run);
      }
      const stats = await db.getWorkspaceStats(workspace.id);
      return json({ ok: true, runs, stats });
    }

    // Settings & Notifications
    if (method === "GET" && path === "/api/settings") {
      return json({ workspace: sanitizeWorkspace(workspace) });
    }

    if (method === "PATCH" && path === "/api/settings") {
      const body = await readJsonBody<{
        name?: unknown;
        productName?: unknown;
        productDescription?: unknown;
        productUrl?: unknown;
        idealCustomer?: unknown;
        defaultTone?: unknown;
        slackWebhookUrl?: unknown;
        discordWebhookUrl?: unknown;
        customOpenaiKey?: unknown;
        xBearerToken?: unknown;
        apifyToken?: unknown;
      }>(req);
      if (!body) return json({ error: "Invalid JSON body." }, 400);

      const patch: Partial<WorkspaceRecord> = {};
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
      if (typeof body.defaultTone === "string" && ALLOWED_TONES.includes(body.defaultTone as ReplyTone)) {
        patch.defaultTone = body.defaultTone as ReplyTone;
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
      const sampleMonitor: MonitorRecord = (await db.listMonitors(workspace.id))[0] ?? {
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
        createdAt: new Date().toISOString(),
      };
      const sampleLead: LeadRecord = {
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
          "Covers Reddit, X, LinkedIn, and Hacker News for free",
        ],
        replySoftMention: `Full disclosure: building ${workspace.productName || "SignalScout"} for this exact workflow.`,
        replyDraft: `Paying per-channel add-ons only to wade through keyword spam is frustrating.\n\n- Filter mentions by buying intent before Slack\n- Covers Reddit, X, LinkedIn, and Hacker News for free\n\nFull disclosure: building ${workspace.productName || "SignalScout"} for this exact workflow.`,
        replyTone: workspace.defaultTone,
        status: "new",
        alertSentSlack: false,
        alertSentDiscord: false,
        sourceMode: "simulation",
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const dispatch = await dispatchWebhookAlerts(sampleLead, sampleMonitor, workspace, fetchFn);
      return json({ ok: dispatch.slackSent || dispatch.discordSent, dispatch });
    }

    // Simplified free status route (no Stripe subscriptions or paid tiers)
    if (method === "GET" && path === "/api/billing") {
      const stats = await db.getWorkspaceStats(workspace.id);
      return json({
        ...getFreePlanStatus(),
        stats,
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

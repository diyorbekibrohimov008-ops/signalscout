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
import { cancelSubscription, subscribeFlat25, verifyStripeWebhookSignature } from "./billing";
import type { SignalScoutDb } from "./db";
import { getEnv } from "./env";
import { classifyIntent, runStage1Filter } from "./intent";
import { buildSlackPayload, dispatchWebhookAlerts } from "./notifier";
import { processCandidatePosts, regenerateLeadReply, runMonitorScan } from "./pipeline";
import { generateReplyOutline } from "./reply";
import { ensureDemoWorkspace } from "./seed";
import type { Channel, LeadRecord, LeadStatus, MonitorRecord, RawSocialPost, ReplyTone, WorkspaceRecord } from "./types";

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
    plan: ws.plan,
    trialEndsAt: ws.trialEndsAt,
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
    return (await req.json()) as T;
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

function parseTerms(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const ALLOWED_CHANNELS: Channel[] = ["reddit", "x", "linkedin", "hackernews"];
function parseChannels(input: unknown): Channel[] {
  if (!Array.isArray(input)) return [...ALLOWED_CHANNELS];
  const filtered = input.filter((c): c is Channel => ALLOWED_CHANNELS.includes(c as Channel));
  return filtered.length > 0 ? filtered : [...ALLOWED_CHANNELS];
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
        database: getEnv("NETLIFY_DB_URL") ? "postgres" : "memory",
        aiGatewayActive: Boolean(getEnv("OPENAI_BASE_URL") || getEnv("OPENAI_API_KEY")),
        stripeConfigured: Boolean(getEnv("STRIPE_SECRET_KEY") && getEnv("STRIPE_PRICE_ID_FLAT_25")),
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Public interactive intent-filter & Slack preview playground
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

      if (!body || (!body.body?.trim() && !body.title?.trim())) {
        return json({ error: "Provide post title or body to evaluate." }, 400);
      }

      const channel: Channel = ALLOWED_CHANNELS.includes(body.channel as Channel) ? (body.channel as Channel) : "reddit";
      const post: RawSocialPost = {
        channel,
        externalId: `playground_${Date.now()}`,
        author: "prospect",
        authorHandle: body.authorHandle?.trim() || (channel === "x" ? "@prospect" : "u/prospect"),
        title: body.title?.trim() || "",
        body: body.body?.trim() || "",
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

      const tempMonitor: MonitorRecord = {
        id: "mon_playground",
        workspaceId: "ws_playground",
        name: "Playground Monitor",
        keywords: parseTerms(body.keywords).length > 0 ? parseTerms(body.keywords) : ["social listening", "monitoring"],
        competitors: parseTerms(body.competitors).length > 0 ? parseTerms(body.competitors) : ["syften", "octolens"],
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
        name: "Playground",
        productName: body.productName?.trim() || "SignalScout",
        productDescription:
          body.productDescription?.trim() ||
          "All-channel buying-intent listening at $25/mo flat with LLM filtering and Slack reply outlines.",
        productUrl: "https://signalscout.app",
        idealCustomer: "SaaS founders",
        defaultTone: body.tone || "founder",
        plan: "pro_flat_25",
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

      const reply = generateReplyOutline(post, analysis, tempWorkspace, body.tone || "founder");
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
        email?: string;
        name?: string;
        password?: string;
        companyName?: string;
        productName?: string;
        productDescription?: string;
      }>(req);

      if (!body?.email?.includes("@") || !body?.password || body.password.length < 6 || !body?.name?.trim()) {
        return json({ error: "Name, valid email, and password (6+ chars) are required." }, 400);
      }

      const existing = await db.findUserByEmail(body.email);
      if (existing) {
        return json({ error: "An account with this email already exists." }, 409);
      }

      const passwordHash = await hashPassword(body.password);
      const { user, workspace } = await db.createUserWithWorkspace({
        email: body.email,
        name: body.name,
        passwordHash,
        companyName: body.companyName,
        productName: body.productName || body.companyName || "My Product",
        productDescription: body.productDescription,
      });

      const token = await signSessionToken({ userId: user.id, workspaceId: workspace.id, email: user.email });
      return json(
        { user: { id: user.id, email: user.email, name: user.name }, workspace: sanitizeWorkspace(workspace) },
        201,
        { "Set-Cookie": buildSessionCookie(token) },
      );
    }

    if (method === "POST" && path === "/api/auth/login") {
      const body = await readJsonBody<{ email?: string; password?: string }>(req);
      if (!body?.email || !body?.password) {
        return json({ error: "Email and password are required." }, 400);
      }
      const user = await db.findUserByEmail(body.email);
      if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
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
        monitorId?: string;
        posts?: Array<{
          channel: Channel;
          externalId?: string;
          author?: string;
          authorHandle?: string;
          title?: string;
          body: string;
          url?: string;
          community?: string;
          publishedAt?: string;
        }>;
      }>(req);

      const monitors = await db.listMonitors(workspace.id);
      const targetMonitor =
        (body?.monitorId ? monitors.find((m) => m.id === body.monitorId) : monitors.find((m) => m.isActive)) ??
        monitors[0];
      if (!targetMonitor) {
        return json({ error: "No monitor found in workspace to route ingested posts." }, 400);
      }

      const rawPosts: RawSocialPost[] = (body?.posts ?? [])
        .filter((p) => p && typeof p.body === "string" && p.body.trim().length > 0)
        .map((p, idx) => ({
          channel: ALLOWED_CHANNELS.includes(p.channel) ? p.channel : "x",
          externalId: p.externalId?.trim() || `wh_${Date.now()}_${idx}`,
          author: p.author?.trim() || "Author",
          authorHandle: p.authorHandle?.trim() || p.author?.trim() || "@author",
          title: p.title?.trim() || "",
          body: p.body.trim(),
          url: p.url?.trim() || "https://signalscout.app",
          community: p.community?.trim() || p.channel.toUpperCase(),
          publishedAt: p.publishedAt || new Date().toISOString(),
          sourceMode: "webhook",
        }));

      const scanRun = await processCandidatePosts(
        db,
        workspace,
        targetMonitor,
        rawPosts,
        {
          webhook: {
            channel: rawPosts[0]?.channel || "x",
            status: "live",
            fetched: rawPosts.length,
            note: `Ingested ${rawPosts.length} post(s) via webhook bridge`,
          },
        },
        { triggerType: "webhook", fetchFn },
      );

      return json({ ok: true, scanRun });
    }

    // 5. Stripe Webhook receiver
    if (method === "POST" && path === "/api/billing/stripe-webhook") {
      const secret = getEnv("STRIPE_WEBHOOK_SECRET") || "";
      const rawBody = await req.text();
      if (secret && !verifyStripeWebhookSignature(rawBody, req.headers.get("stripe-signature"), secret)) {
        return json({ error: "Invalid Stripe signature." }, 400);
      }
      const event = JSON.parse(rawBody) as {
        type?: string;
        data?: { object?: { client_reference_id?: string; metadata?: { workspace_id?: string }; customer?: string; subscription?: string } };
      };
      const obj = event.data?.object;
      const wsId = obj?.client_reference_id || obj?.metadata?.workspace_id;
      if (wsId && event.type === "checkout.session.completed") {
        const ws = await db.getWorkspaceById(wsId);
        if (ws) {
          await db.updateWorkspace(ws.id, {
            plan: "pro_flat_25",
            stripeCustomerId: obj?.customer ?? null,
            stripeSubscriptionId: obj?.subscription ?? null,
          });
          await db.insertBillingEvent({
            workspaceId: ws.id,
            eventType: "stripe_checkout_completed",
            amountCents: 2500,
            description: "Subscribed to All-Channel Flat Plan ($25/mo via Stripe)",
          });
        }
      }
      return json({ received: true });
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

    // Monitors CRUD
    if (method === "GET" && path === "/api/monitors") {
      const monitors = await db.listMonitors(workspace.id);
      return json({ monitors });
    }

    if (method === "POST" && path === "/api/monitors") {
      const body = await readJsonBody<{
        name?: string;
        keywords?: string[] | string;
        competitors?: string[] | string;
        negativeKeywords?: string[] | string;
        channels?: Channel[];
        minConfidence?: number;
      }>(req);

      const keywords = parseTerms(body?.keywords);
      const competitors = parseTerms(body?.competitors);
      if (!body?.name?.trim() || (keywords.length === 0 && competitors.length === 0)) {
        return json({ error: "Monitor name and at least one keyword or competitor are required." }, 400);
      }

      const monitor = await db.createMonitor({
        workspaceId: workspace.id,
        name: body.name,
        keywords,
        competitors,
        negativeKeywords: parseTerms(body.negativeKeywords),
        channels: parseChannels(body.channels),
        minConfidence: Math.max(40, Math.min(98, Number(body.minConfidence ?? 70))),
      });
      return json({ monitor }, 201);
    }

    const monitorMatch = path.match(/^\/api\/monitors\/([^/]+)$/);
    if (monitorMatch) {
      const monitorId = monitorMatch[1];
      if (method === "PATCH") {
        const body = await readJsonBody<{
          name?: string;
          keywords?: string[] | string;
          competitors?: string[] | string;
          negativeKeywords?: string[] | string;
          channels?: Channel[];
          minConfidence?: number;
          isActive?: boolean;
        }>(req);
        if (!body) return json({ error: "Invalid JSON body." }, 400);

        const patch: Partial<MonitorRecord> = {};
        if (body.name !== undefined) patch.name = body.name.trim();
        if (body.keywords !== undefined) patch.keywords = parseTerms(body.keywords);
        if (body.competitors !== undefined) patch.competitors = parseTerms(body.competitors);
        if (body.negativeKeywords !== undefined) patch.negativeKeywords = parseTerms(body.negativeKeywords);
        if (body.channels !== undefined) patch.channels = parseChannels(body.channels);
        if (body.minConfidence !== undefined) patch.minConfidence = Math.max(40, Math.min(98, Number(body.minConfidence)));
        if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);

        const updated = await db.updateMonitor(workspace.id, monitorId, patch);
        return updated ? json({ monitor: updated }) : json({ error: "Monitor not found." }, 404);
      }

      if (method === "DELETE") {
        const deleted = await db.deleteMonitor(workspace.id, monitorId);
        return deleted ? json({ ok: true }) : json({ error: "Monitor not found." }, 404);
      }
    }

    // Leads Inbox & Noise Audit
    if (method === "GET" && path === "/api/leads") {
      const channel = (url.searchParams.get("channel") as Channel | "all") || "all";
      const status = (url.searchParams.get("status") as LeadStatus | "all") || "all";
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
      const lead = await db.getLead(workspace.id, leadRegenMatch[1]);
      if (!lead) return json({ error: "Lead not found." }, 404);
      const body = await readJsonBody<{ tone?: ReplyTone }>(req);
      const tone: ReplyTone =
        body?.tone === "peer" || body?.tone === "technical" || body?.tone === "founder"
          ? body.tone
          : workspace.defaultTone;
      const updated = await regenerateLeadReply(db, workspace, lead, tone);
      return json({ lead: updated });
    }

    const leadSlackMatch = path.match(/^\/api\/leads\/([^/]+)\/send-slack$/);
    if (leadSlackMatch && method === "POST") {
      const lead = await db.getLead(workspace.id, leadSlackMatch[1]);
      if (!lead) return json({ error: "Lead not found." }, 404);
      const monitor = await db.getMonitor(workspace.id, lead.monitorId);
      if (!monitor) return json({ error: "Monitor not found." }, 404);
      if (!workspace.slackWebhookUrl && !workspace.discordWebhookUrl) {
        return json({ error: "Configure a Slack or Discord webhook URL in Integrations first." }, 400);
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
      const body = await readJsonBody<{ status?: LeadStatus; replyDraft?: string }>(req);
      if (!body) return json({ error: "Invalid JSON body." }, 400);
      const patch: Partial<LeadRecord> = {};
      if (body.status && ["new", "replied", "dismissed"].includes(body.status)) {
        patch.status = body.status;
      }
      if (typeof body.replyDraft === "string") {
        patch.replyDraft = body.replyDraft;
      }
      const updated = await db.updateLead(workspace.id, leadMatch[1], patch);
      return updated ? json({ lead: updated }) : json({ error: "Lead not found." }, 404);
    }

    // On-demand scan
    if (method === "POST" && path === "/api/scan") {
      const body = await readJsonBody<{ monitorId?: string; includeSimulation?: boolean }>(req);
      const monitors = await db.listMonitors(workspace.id);
      const targets = body?.monitorId
        ? monitors.filter((m) => m.id === body.monitorId)
        : monitors.filter((m) => m.isActive);

      if (targets.length === 0) {
        return json({ error: "No active monitors found. Create or enable a monitor first." }, 400);
      }

      const runs = [];
      for (const mon of targets.slice(0, 5)) {
        const run = await runMonitorScan(db, workspace, mon, {
          triggerType: "manual",
          includeSimulation: body?.includeSimulation ?? true,
          fetchFn,
        });
        runs.push(run);
      }
      const stats = await db.getWorkspaceStats(workspace.id);
      return json({ ok: true, runs, stats });
    }

    // Settings & Webhook tests
    if (method === "GET" && path === "/api/settings") {
      return json({ workspace: sanitizeWorkspace(workspace) });
    }

    if (method === "PATCH" && path === "/api/settings") {
      const body = await readJsonBody<{
        name?: string;
        productName?: string;
        productDescription?: string;
        productUrl?: string;
        idealCustomer?: string;
        defaultTone?: ReplyTone;
        slackWebhookUrl?: string;
        discordWebhookUrl?: string;
        customOpenaiKey?: string;
        xBearerToken?: string;
        apifyToken?: string;
      }>(req);
      if (!body) return json({ error: "Invalid JSON body." }, 400);

      const patch: Partial<WorkspaceRecord> = {};
      if (body.name !== undefined) patch.name = body.name.trim();
      if (body.productName !== undefined) patch.productName = body.productName.trim();
      if (body.productDescription !== undefined) patch.productDescription = body.productDescription.trim();
      if (body.productUrl !== undefined) patch.productUrl = body.productUrl.trim();
      if (body.idealCustomer !== undefined) patch.idealCustomer = body.idealCustomer.trim();
      if (body.defaultTone && ["founder", "peer", "technical"].includes(body.defaultTone)) {
        patch.defaultTone = body.defaultTone;
      }
      if (body.slackWebhookUrl !== undefined) {
        const trimmed = body.slackWebhookUrl.trim();
        if (trimmed && !/^https:\/\/[a-z0-9.-]+/i.test(trimmed)) {
          return json({ error: "Slack webhook URL must use https://." }, 400);
        }
        patch.slackWebhookUrl = trimmed;
      }
      if (body.discordWebhookUrl !== undefined) {
        const trimmed = body.discordWebhookUrl.trim();
        if (trimmed && !/^https:\/\/[a-z0-9.-]+/i.test(trimmed)) {
          return json({ error: "Discord webhook URL must use https://." }, 400);
        }
        patch.discordWebhookUrl = trimmed;
      }
      if (body.customOpenaiKey !== undefined && body.customOpenaiKey !== "***") {
        patch.customOpenaiKey = body.customOpenaiKey.trim();
      }
      if (body.xBearerToken !== undefined && body.xBearerToken !== "***") {
        patch.xBearerToken = body.xBearerToken.trim();
      }
      if (body.apifyToken !== undefined && body.apifyToken !== "***") {
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
        name: "SignalScout Test Monitor",
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
        title: "Test Alert: Looking for an alternative to Syften without X add-ons?",
        body: "This is a live test alert from SignalScout verifying your webhook and Contextual Reply Outline formatting.",
        url: "https://www.reddit.com/r/SaaS/",
        community: "r/SaaS",
        intentType: "recommendation_request",
        confidenceScore: 94,
        buyingUrgency: "high",
        reasoning: "Test alert — confirms LLM intent badge and reply assistant outline render cleanly in Slack/Discord.",
        painPoints: ["channel add-on pricing", "noisy Slack alerts"],
        isFilteredNoise: false,
        replyHook: "Paying per-channel add-ons only to wade through keyword spam is frustrating.",
        replyValuePoints: ["Filter mentions by buying intent before Slack", "Flat $25/mo across Reddit, X, LinkedIn, HN"],
        replySoftMention: `Full disclosure: building ${workspace.productName || "SignalScout"} for this exact workflow.`,
        replyDraft: `Paying per-channel add-ons only to wade through keyword spam is frustrating.\n\n- Filter mentions by buying intent before Slack\n- Flat $25/mo across Reddit, X, LinkedIn, HN\n\nFull disclosure: building ${workspace.productName || "SignalScout"} for this exact workflow.`,
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

    // Billing & Subscription ($25/mo flat)
    if (method === "GET" && path === "/api/billing") {
      const [events, stats] = await Promise.all([
        db.listBillingEvents(workspace.id),
        db.getWorkspaceStats(workspace.id),
      ]);
      return json({
        plan: workspace.plan,
        priceMonthlyCents: 2500,
        trialEndsAt: workspace.trialEndsAt,
        stripeConfigured: Boolean(getEnv("STRIPE_SECRET_KEY") && getEnv("STRIPE_PRICE_ID_FLAT_25")),
        events,
        stats,
      });
    }

    if (method === "POST" && path === "/api/billing/subscribe") {
      const result = await subscribeFlat25(db, workspace, url.origin, fetchFn);
      return json(result);
    }

    if (method === "POST" && path === "/api/billing/cancel") {
      const updated = await cancelSubscription(db, workspace);
      return json({ plan: updated?.plan ?? "canceled" });
    }

    return json({ error: `Route not found: ${method} ${path}` }, 404);
  } catch (err) {
    console.error("API Error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
}

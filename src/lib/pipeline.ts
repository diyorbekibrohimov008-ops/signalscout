import { fetchHackerNewsPosts } from "./channels/hn";
import { fetchLinkedInPosts } from "./channels/linkedin";
import { fetchRedditPosts } from "./channels/reddit";
import type { ChannelFetchResponse } from "./channels/types";
import { fetchXPosts } from "./channels/x";
import type { SignalScoutDb } from "./db";
import { classifyIntent, runStage1Filter } from "./intent";
import { dispatchWebhookAlerts } from "./notifier";
import { generateReplyOutline } from "./reply";
import type {
  Channel,
  ChannelFetchStatus,
  LeadRecord,
  MonitorRecord,
  RawSocialPost,
  ScanRunRecord,
  WorkspaceRecord,
} from "./types";

export interface RunScanOptions {
  triggerType: "manual" | "cron" | "webhook";
  includeSimulation?: boolean;
  fetchFn?: typeof fetch;
  channelFetchers?: Partial<Record<Channel, (terms: string[]) => Promise<ChannelFetchResponse>>>;
  incomingPosts?: RawSocialPost[];
}

export async function processCandidatePosts(
  db: SignalScoutDb,
  workspace: WorkspaceRecord,
  monitor: MonitorRecord,
  posts: RawSocialPost[],
  channelStatuses: Record<string, ChannelFetchStatus>,
  opts: { triggerType: "manual" | "cron" | "webhook"; fetchFn?: typeof fetch },
): Promise<ScanRunRecord> {
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
        publishedAt: post.publishedAt,
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
      publishedAt: post.publishedAt,
    });

    if (inserted) {
      const dispatch = await dispatchWebhookAlerts(inserted, monitor, workspace, opts.fetchFn);
      if (dispatch.slackSent || dispatch.discordSent) {
        alertsDispatched++;
        await db.updateLead(workspace.id, inserted.id, {
          alertSentSlack: dispatch.slackSent,
          alertSentDiscord: dispatch.discordSent,
        });
      }
    }
  }

  await db.updateMonitor(workspace.id, monitor.id, {
    lastScannedAt: new Date().toISOString(),
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
    channelStatuses,
  });
}

export async function runMonitorScan(
  db: SignalScoutDb,
  workspace: WorkspaceRecord,
  monitor: MonitorRecord,
  options: RunScanOptions,
): Promise<ScanRunRecord> {
  const fetchFn = options.fetchFn ?? fetch;
  const searchTerms = [...monitor.competitors, ...monitor.keywords].filter(Boolean);
  const channelStatuses: Record<string, ChannelFetchStatus> = {};
  const allPosts: RawSocialPost[] = [];

  if (options.incomingPosts) {
    allPosts.push(...options.incomingPosts);
  } else {
    const tasks = monitor.channels.map(async (channel): Promise<ChannelFetchResponse> => {
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
          fetchFn,
        });
      }
      return fetchLinkedInPosts(searchTerms, {
        apifyToken: workspace.apifyToken,
        includeSimulation: options.includeSimulation,
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
    fetchFn,
  });
}

export async function regenerateLeadReply(
  db: SignalScoutDb,
  workspace: WorkspaceRecord,
  lead: LeadRecord,
  tone: WorkspaceRecord["defaultTone"],
): Promise<LeadRecord | null> {
  const post: RawSocialPost = {
    channel: lead.channel,
    externalId: lead.externalId,
    author: lead.author,
    authorHandle: lead.authorHandle,
    title: lead.title,
    body: lead.body,
    url: lead.url,
    community: lead.community,
    publishedAt: lead.publishedAt,
    sourceMode: lead.sourceMode,
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
      classifierMode: "heuristic",
    },
    workspace,
    tone,
  );
  return db.updateLead(workspace.id, lead.id, {
    replyHook: outline.hook,
    replyValuePoints: outline.valuePoints,
    replySoftMention: outline.softMention,
    replyDraft: outline.fullDraft,
    replyTone: outline.tone,
  });
}

import { describe, expect, it } from "vitest";
import { buildDiscordPayload, buildSlackPayload, dispatchWebhookAlerts } from "../lib/notifier";
import type { LeadRecord, MonitorRecord, WorkspaceRecord } from "../lib/types";

const workspace: WorkspaceRecord = {
  id: "ws_1",
  ownerUserId: "usr_1",
  name: "SignalScout",
  productName: "SignalScout",
  productDescription: "All-channel buying-intent listener",
  productUrl: "https://signalscout.app",
  idealCustomer: "SaaS founders",
  defaultTone: "founder",
  plan: "free",
  trialEndsAt: new Date(Date.now() + 86400_000 * 14).toISOString(),
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  slackWebhookUrl: "https://hooks.slack.com/services/T00/B00/XXX",
  discordWebhookUrl: "https://discord.com/api/webhooks/123/abc",
  customOpenaiKey: "",
  xBearerToken: "",
  apifyToken: "",
  ingestSecret: "sec_1",
  createdAt: new Date().toISOString(),
};

const monitor: MonitorRecord = {
  id: "mon_1",
  workspaceId: "ws_1",
  name: "Competitor Switchers",
  keywords: ["social listening"],
  competitors: ["syften"],
  negativeKeywords: [],
  channels: ["reddit", "x", "linkedin", "hackernews"],
  minConfidence: 70,
  isActive: true,
  lastScannedAt: null,
  createdAt: new Date().toISOString(),
};

const lead: LeadRecord = {
  id: "lead_1",
  workspaceId: "ws_1",
  monitorId: "mon_1",
  channel: "reddit",
  externalId: "ext_1",
  author: "alex",
  authorHandle: "u/alex",
  title: "Alternative to Syften without X add-on fees?",
  body: "Looking for a tool that filters out keyword noise before hitting Slack.",
  url: "https://reddit.com/r/SaaS/comments/xyz",
  community: "r/SaaS",
  intentType: "competitor_complaint",
  confidenceScore: 92,
  buyingUrgency: "high",
  reasoning: "Explicitly complains about Syften pricing add-ons and seeks a filtered alternative.",
  painPoints: ["add-on fees", "keyword noise"],
  isFilteredNoise: false,
  replyHook: "Paying extra per social network adds up fast when you only want real buyer threads.",
  replyValuePoints: ["Filter mentions by intent before Slack", "Track Reddit + X + HN + LinkedIn in one feed"],
  replySoftMention: "Full disclosure: I built SignalScout for this exact workflow (free across all channels).",
  replyDraft: "Paying extra per social network adds up fast...\n\n- Filter mentions by intent\n\nFull disclosure: I built SignalScout.",
  replyTone: "founder",
  status: "new",
  alertSentSlack: false,
  alertSentDiscord: false,
  sourceMode: "live",
  publishedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

describe("Slack & Discord Webhook Notifier", () => {
  it("builds Slack Block Kit payload with intent signal, link button, and reply outline", () => {
    const payload = buildSlackPayload(lead, monitor);
    const serialized = JSON.stringify(payload);

    expect(payload.blocks.length).toBeGreaterThanOrEqual(4);
    expect(serialized).toContain("92/100");
    expect(serialized).toContain("Contextual Reply Outline");
    const replyBlock = payload.blocks[5] as { text?: { text?: string } };
    expect(replyBlock.text?.text).toContain(lead.replyDraft);
    expect(serialized).toContain(lead.url);
  });

  it("builds Discord embed payload with urgency metadata and reply draft", () => {
    const payload = buildDiscordPayload(lead, monitor);
    const serialized = JSON.stringify(payload);

    expect(payload.embeds).toHaveLength(1);
    expect(serialized).toContain("92/100");
    expect(serialized).toContain(lead.url);
    expect(serialized).toContain(lead.replyHook);
  });

  it("dispatches Slack and Discord webhooks and captures errors without throwing", async () => {
    const calls: string[] = [];
    const result = await dispatchWebhookAlerts(lead, monitor, workspace, async (url) => {
      calls.push(String(url));
      if (String(url).includes("discord")) {
        return new Response("Rate limited", { status: 429 });
      }
      return new Response("ok", { status: 200 });
    });

    expect(calls).toHaveLength(2);
    expect(result.slackSent).toBe(true);
    expect(result.discordSent).toBe(false);
    expect(result.errors.length).toBe(1);
  });
});

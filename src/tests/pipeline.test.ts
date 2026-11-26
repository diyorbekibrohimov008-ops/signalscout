import { describe, expect, it } from "vitest";
import { MemoryDb } from "../lib/db";
import { runMonitorScan } from "../lib/pipeline";
import type { RawSocialPost } from "../lib/types";

describe("End-to-end Monitor Scan Pipeline", () => {
  it("filters noise, saves high-intent leads, deduplicates rescans, and dispatches Slack once", async () => {
    const db = new MemoryDb();
    const { user, workspace } = await db.createUserWithWorkspace({
      email: "founder@acme.io",
      name: "Sam Founder",
      passwordHash: "hash",
      companyName: "Acme",
      productName: "SignalScout",
      productDescription: "Free all-channel buying-intent monitoring.",
      slackWebhookUrl: "https://hooks.slack.com/services/T00/B00/ZZZ",
    });

    const monitor = await db.createMonitor({
      workspaceId: workspace.id,
      name: "Intent Switchers",
      keywords: ["social listening", "reddit monitoring"],
      competitors: ["syften"],
      negativeKeywords: ["hiring"],
      channels: ["reddit", "hackernews"],
      minConfidence: 70,
    });

    const samplePosts: RawSocialPost[] = [
      {
        channel: "reddit",
        externalId: "r_good_1",
        author: "pat",
        authorHandle: "u/pat",
        title: "Looking for an alternative to Syften for Reddit monitoring",
        body: "Tired of paying $40/mo extra for X add-ons. Any recommendations?",
        url: "https://reddit.com/r/SaaS/comments/good1",
        community: "r/SaaS",
        publishedAt: new Date().toISOString(),
        sourceMode: "live",
      },
      {
        channel: "reddit",
        externalId: "r_spam_1",
        author: "seo_spammer",
        authorHandle: "u/seo_spammer",
        title: "Top 10 social listening tools in 2026",
        body: "Just published a guide on our blog comparing social listening workflows.",
        url: "https://reddit.com/r/SaaS/comments/spam1",
        community: "r/SaaS",
        publishedAt: new Date().toISOString(),
        sourceMode: "live",
      },
      {
        channel: "hackernews",
        externalId: "hn_neg_1",
        author: "hr_bot",
        authorHandle: "hr_bot",
        title: "Hiring social listening intern ($20/hr)",
        body: "Remote internship for reddit monitoring.",
        url: "https://news.ycombinator.com/item?id=999",
        community: "Hacker News",
        publishedAt: new Date().toISOString(),
        sourceMode: "live",
      },
    ];

    let webhookHits = 0;
    const mockFetch: typeof fetch = async () => {
      webhookHits++;
      return new Response("ok", { status: 200 });
    };

    const run1 = await runMonitorScan(db, workspace, monitor, {
      triggerType: "manual",
      fetchFn: mockFetch,
      channelFetchers: {
        reddit: async () => ({
          posts: samplePosts.filter((p) => p.channel === "reddit"),
          status: { channel: "reddit", status: "live", fetched: 2, note: "OK" },
        }),
        hackernews: async () => ({
          posts: samplePosts.filter((p) => p.channel === "hackernews"),
          status: { channel: "hackernews", status: "live", fetched: 1, note: "OK" },
        }),
      },
    });

    expect(run1.postsFetched).toBe(3);
    expect(run1.stage1Dropped).toBe(1); // hiring negative keyword
    expect(run1.llmFilteredNoise).toBe(1); // affiliate blog spam
    expect(run1.highIntentMatched).toBe(1);
    expect(run1.alertsDispatched).toBe(1);
    expect(webhookHits).toBe(1);

    const leads = await db.listLeads(workspace.id, { includeNoise: false });
    expect(leads).toHaveLength(1);
    expect(leads[0].externalId).toBe("r_good_1");
    expect(leads[0].alertSentSlack).toBe(true);
    expect(leads[0].replyDraft).toContain("SignalScout");

    const noise = await db.listLeads(workspace.id, { onlyNoise: true });
    expect(noise).toHaveLength(1);
    expect(noise[0].externalId).toBe("r_spam_1");

    // Re-running same posts should deduplicate and NOT dispatch Slack a second time!
    const run2 = await runMonitorScan(db, workspace, monitor, {
      triggerType: "cron",
      fetchFn: mockFetch,
      channelFetchers: {
        reddit: async () => ({
          posts: samplePosts.filter((p) => p.channel === "reddit"),
          status: { channel: "reddit", status: "live", fetched: 2, note: "OK" },
        }),
        hackernews: async () => ({
          posts: samplePosts.filter((p) => p.channel === "hackernews"),
          status: { channel: "hackernews", status: "live", fetched: 1, note: "OK" },
        }),
      },
    });

    expect(run2.highIntentMatched).toBe(0);
    expect(run2.alertsDispatched).toBe(0);
    expect(webhookHits).toBe(1);
    expect(user.email).toBe("founder@acme.io");
  });
});

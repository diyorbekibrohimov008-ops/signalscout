import { describe, expect, it } from "vitest";
import { classifyIntent, runStage1Filter } from "../lib/intent";
import type { MonitorRecord, RawSocialPost, WorkspaceRecord } from "../lib/types";

const baseWorkspace: WorkspaceRecord = {
  id: "ws_1",
  ownerUserId: "usr_1",
  name: "SignalScout",
  productName: "SignalScout",
  productDescription:
    "All-channel buying-intent listening for Reddit, X, LinkedIn, and HN at $25/mo flat with LLM filtering and contextual Slack reply outlines.",
  productUrl: "https://signalscout.app",
  idealCustomer: "B2B SaaS founders and growth teams",
  defaultTone: "founder",
  plan: "pro_flat_25",
  trialEndsAt: new Date(Date.now() + 86400_000 * 14).toISOString(),
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  slackWebhookUrl: "",
  discordWebhookUrl: "",
  customOpenaiKey: "",
  xBearerToken: "",
  apifyToken: "",
  ingestSecret: "sec_123",
  createdAt: new Date().toISOString(),
};

const baseMonitor: MonitorRecord = {
  id: "mon_1",
  workspaceId: "ws_1",
  name: "Social Listening & Syften Switchers",
  keywords: ["social listening", "reddit monitoring", "buying intent"],
  competitors: ["syften", "octolens"],
  negativeKeywords: ["hiring", "internship", "crypto giveaway"],
  channels: ["reddit", "x", "linkedin", "hackernews"],
  minConfidence: 70,
  isActive: true,
  lastScannedAt: null,
  createdAt: new Date().toISOString(),
};

function makePost(overrides: Partial<RawSocialPost>): RawSocialPost {
  return {
    channel: "reddit",
    externalId: "post_1",
    author: "alex_founder",
    authorHandle: "u/alex_founder",
    title: "",
    body: "",
    url: "https://reddit.com/r/SaaS/comments/1",
    community: "r/SaaS",
    publishedAt: new Date().toISOString(),
    sourceMode: "live",
    ...overrides,
  };
}

describe("Stage 1 keyword & spam pre-filter", () => {
  it("drops posts containing negative keywords even when a monitor keyword is present", () => {
    const post = makePost({
      title: "Hiring Growth Marketer for Reddit monitoring ($70k/yr)",
      body: "We are looking for a full-time intern or manager to do social listening.",
    });

    const result = runStage1Filter(post, baseMonitor);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/negative/i);
  });

  it("drops posts with zero matching keywords or competitors", () => {
    const post = makePost({
      title: "Best espresso machine under $500?",
      body: "Looking for recommendations for a home espresso setup.",
    });

    const result = runStage1Filter(post, baseMonitor);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/no keyword/i);
  });

  it("passes genuine posts mentioning monitor keywords or competitors", () => {
    const post = makePost({
      title: "Anyone moved off Syften recently?",
      body: "Their X add-on pricing is getting ridiculous for social listening.",
    });

    const result = runStage1Filter(post, baseMonitor);
    expect(result.passed).toBe(true);
    expect(result.matchedTerms).toContain("syften");
  });
});

describe("Stage 2 buying-intent classifier", () => {
  it("detects high-confidence recommendation requests and sets shouldAlert=true", async () => {
    const post = makePost({
      title: "Looking for an alternative to Syften for Reddit & X monitoring?",
      body: "Any recommendations for a social listening tool that doesn't charge $40 extra just for Twitter?",
    });

    const result = await classifyIntent(post, baseMonitor, baseWorkspace);
    expect(result.shouldAlert).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(75);
    expect(["recommendation_request", "competitor_complaint"]).toContain(result.intentType);
    expect(result.painPoints.length).toBeGreaterThan(0);
  });

  it("detects competitor complaints about noise and spam", async () => {
    const post = makePost({
      channel: "hackernews",
      title: "Ask HN: How do you filter out keyword spam in Octolens?",
      body: "Octolens keeps flooding our Slack with 200 irrelevant mentions every week. Sick of manually sorting noise.",
    });

    const result = await classifyIntent(post, baseMonitor, baseWorkspace);
    expect(result.intentType).toBe("competitor_complaint");
    expect(result.shouldAlert).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(75);
  });

  it("detects explicit buying intent with high urgency", async () => {
    const post = makePost({
      channel: "linkedin",
      title: "Evaluating social listening tools this week",
      body: "We have budget approved to buy a buying intent monitor for Reddit and LinkedIn ASAP. Ready to switch today.",
    });

    const result = await classifyIntent(post, baseMonitor, baseWorkspace);
    expect(result.intentType).toBe("explicit_buying_intent");
    expect(result.buyingUrgency).toBe("high");
    expect(result.shouldAlert).toBe(true);
  });

  it("filters out promotional blog posts and SEO listicles as noise", async () => {
    const post = makePost({
      channel: "x",
      title: "Top 15 Social Listening Tools in 2026 [Thread]",
      body: "I tested Syften and other Reddit monitoring apps. Read our full affiliate guide and use promo code SAVE20.",
    });

    const result = await classifyIntent(post, baseMonitor, baseWorkspace);
    expect(result.intentType).toBe("noise_or_irrelevant");
    expect(result.shouldAlert).toBe(false);
    expect(result.confidenceScore).toBeLessThan(70);
  });

  it("respects monitor minConfidence threshold", async () => {
    const strictMonitor: MonitorRecord = { ...baseMonitor, minConfidence: 99 };
    const post = makePost({
      title: "Thoughts on reddit monitoring tools?",
      body: "Just curious what people use for social listening these days.",
    });

    const result = await classifyIntent(post, strictMonitor, baseWorkspace);
    expect(result.shouldAlert).toBe(false);
  });

  it("uses injected LLM scorer when provided and falls back cleanly on error", async () => {
    const post = makePost({
      title: "Need a Reddit monitoring tool without X add-on fees",
      body: "Evaluating alternatives to Syften for our SaaS team.",
    });

    const llmResult = await classifyIntent(post, baseMonitor, baseWorkspace, {
      llmEvaluate: async () => ({
        intentType: "recommendation_request",
        confidenceScore: 94,
        buyingUrgency: "high",
        reasoning: "Author explicitly asks for a Syften alternative due to X add-on pricing.",
        painPoints: ["add-on pricing", "multi-channel coverage"],
      }),
    });

    expect(llmResult.classifierMode).toBe("llm");
    expect(llmResult.confidenceScore).toBe(94);
    expect(llmResult.shouldAlert).toBe(true);

    const fallbackResult = await classifyIntent(post, baseMonitor, baseWorkspace, {
      llmEvaluate: async () => {
        throw new Error("Upstream LLM timeout");
      },
    });

    expect(fallbackResult.classifierMode).toBe("heuristic");
    expect(fallbackResult.shouldAlert).toBe(true);
  });
});

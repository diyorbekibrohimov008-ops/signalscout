import { describe, expect, it } from "vitest";
import { generateReplyOutline } from "../lib/reply";
import type { IntentAnalysis, RawSocialPost, WorkspaceRecord } from "../lib/types";

const workspace: WorkspaceRecord = {
  id: "ws_1",
  ownerUserId: "usr_1",
  name: "SignalScout",
  productName: "SignalScout",
  productDescription:
    "Free buying-intent listener across Reddit, X, LinkedIn, and HN with LLM noise filtering and Slack reply outlines.",
  productUrl: "https://signalscout.app",
  idealCustomer: "SaaS founders",
  defaultTone: "founder",
  plan: "free",
  trialEndsAt: new Date(Date.now() + 86400_000 * 14).toISOString(),
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  slackWebhookUrl: "",
  discordWebhookUrl: "",
  customOpenaiKey: "",
  xBearerToken: "",
  apifyToken: "",
  ingestSecret: "sec_1",
  createdAt: new Date().toISOString(),
};

const post: RawSocialPost = {
  channel: "reddit",
  externalId: "r_123",
  author: "sarah_b2b",
  authorHandle: "u/sarah_b2b",
  title: "Syften just bumped our bill with X add-ons — alternatives?",
  body: "We mostly care about catching people asking for recommendations without getting 100 noisy Slack pings a day.",
  url: "https://reddit.com/r/SaaS/comments/123",
  community: "r/SaaS",
  publishedAt: new Date().toISOString(),
  sourceMode: "live",
};

const analysis: IntentAnalysis = {
  intentType: "competitor_complaint",
  confidenceScore: 91,
  buyingUrgency: "high",
  reasoning: "Author is unhappy with Syften's X add-on fees and noisy Slack alerts.",
  painPoints: ["channel add-on pricing", "noisy Slack alerts"],
  shouldAlert: true,
  classifierMode: "heuristic",
};

describe("Contextual Reply Assistant", () => {
  it("generates an authentic, non-salesy 3-part outline tailored to the post", () => {
    const reply = generateReplyOutline(post, analysis, workspace, "founder");

    expect(reply.hook.length).toBeGreaterThan(20);
    expect(reply.valuePoints.length).toBeGreaterThanOrEqual(2);
    expect(reply.softMention).toContain("SignalScout");
    expect(reply.fullDraft).toContain(reply.hook);
    expect(reply.fullDraft.toLowerCase()).not.toContain("buy now");
    expect(reply.fullDraft.toLowerCase()).not.toContain("limited time offer");
  });

  it("adapts length and framing for X (concise) vs technical tone", () => {
    const xPost: RawSocialPost = { ...post, channel: "x", authorHandle: "@sarah_b2b" };
    const xReply = generateReplyOutline(xPost, analysis, workspace, "peer");
    const techReply = generateReplyOutline(post, analysis, workspace, "technical");

    expect(xReply.tone).toBe("peer");
    expect(xReply.fullDraft.length).toBeLessThanOrEqual(520);
    expect(techReply.tone).toBe("technical");
    expect(techReply.fullDraft).not.toBe(xReply.fullDraft);
  });

  it("handles missing productName cleanly without undefined strings", () => {
    const minimalWs: WorkspaceRecord = { ...workspace, productName: "", productUrl: "" };
    const reply = generateReplyOutline(post, analysis, minimalWs, "peer");

    expect(reply.fullDraft).not.toContain("undefined");
    expect(reply.softMention).not.toContain("undefined");
  });
});

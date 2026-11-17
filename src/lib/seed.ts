import { hashPassword } from "./auth";
import type { SignalScoutDb } from "./db";
import { processCandidatePosts } from "./pipeline";
import type { RawSocialPost, UserRecord, WorkspaceRecord } from "./types";

export const DEMO_EMAIL = "demo@signalscout.app";
export const DEMO_PASSWORD = "demo-signalscout-password";

export async function ensureDemoWorkspace(
  db: SignalScoutDb,
): Promise<{ user: UserRecord; workspace: WorkspaceRecord }> {
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
    productDescription:
      "All-channel social buying-intent listener across Reddit, X, LinkedIn, and Hacker News for $25/mo flat with LLM noise filtering and Slack reply outlines.",
    productUrl: "https://signalscout.app",
    plan: "pro_flat_25",
  });

  const monitor = await db.createMonitor({
    workspaceId: workspace.id,
    name: "Syften & Octolens Switchers",
    keywords: ["social listening", "reddit monitoring", "buying intent"],
    competitors: ["syften", "octolens", "f5bot"],
    negativeKeywords: ["hiring", "internship", "crypto giveaway"],
    channels: ["reddit", "x", "linkedin", "hackernews"],
    minConfidence: 70,
  });

  const now = Date.now();
  const seedPosts: RawSocialPost[] = [
    {
      channel: "reddit",
      externalId: "demo_reddit_1",
      author: "saas_kyle",
      authorHandle: "u/saas_kyle",
      title: "Looking for an alternative to Syften — X add-on pricing is getting out of hand",
      body: "We've been paying $29.95/mo for basic Reddit + $40/mo just for X monitoring and still get flooded with false positives. What are other B2B SaaS teams switching to?",
      url: "https://www.reddit.com/r/SaaS/",
      community: "r/SaaS",
      publishedAt: new Date(now - 1000 * 60 * 35).toISOString(),
      sourceMode: "simulation",
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
      publishedAt: new Date(now - 1000 * 60 * 75).toISOString(),
      sourceMode: "simulation",
    },
    {
      channel: "linkedin",
      externalId: "demo_li_1",
      author: "Elena Vance",
      authorHandle: "Elena Vance • Head of Growth",
      title: "",
      body: "Evaluating social listening tools this week for our outbound team. Budget approved up to $50/mo if it covers Reddit, LinkedIn, X, and HN cleanly without per-channel add-ons.",
      url: "https://www.linkedin.com/",
      community: "LinkedIn Feed",
      publishedAt: new Date(now - 1000 * 60 * 110).toISOString(),
      sourceMode: "simulation",
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
      publishedAt: new Date(now - 1000 * 60 * 140).toISOString(),
      sourceMode: "simulation",
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
      publishedAt: new Date(now - 1000 * 60 * 180).toISOString(),
      sourceMode: "simulation",
    },
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
      x: { channel: "x", status: "simulated", fetched: 1, note: "Demo workspace starter signal" },
    },
    { triggerType: "manual" },
  );

  return { user, workspace };
}

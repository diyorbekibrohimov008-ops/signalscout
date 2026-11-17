import type { RawSocialPost } from "../types";
import type { ChannelFetchResponse } from "./types";

export interface LinkedInFetchOptions {
  apifyToken?: string;
  includeSimulation?: boolean;
}

function buildSimulatedLinkedInPosts(terms: string[]): RawSocialPost[] {
  const anchor = terms[0] || "social listening";
  const now = Date.now();
  return [
    {
      channel: "linkedin",
      externalId: `sim_li_${Buffer.from(anchor).toString("hex").slice(0, 8)}_1`,
      author: "Daniel Rivera",
      authorHandle: "Daniel Rivera • VP Growth",
      title: "",
      body: `We have Q4 budget approved to switch our ${anchor} stack this week. Octolens is giving us way too many false positives in Slack — what are other B2B teams using?`,
      url: "https://www.linkedin.com/feed/update/urn:li:activity:7261001928374",
      community: "LinkedIn Feed",
      publishedAt: new Date(now - 1000 * 60 * 25).toISOString(),
      sourceMode: "simulation",
    },
  ];
}

export async function fetchLinkedInPosts(
  terms: string[],
  options: LinkedInFetchOptions = {},
): Promise<ChannelFetchResponse> {
  const queryTerms = terms.map((t) => t.trim()).filter(Boolean);

  if (options.includeSimulation) {
    const posts = buildSimulatedLinkedInPosts(queryTerms);
    return {
      posts,
      status: {
        channel: "linkedin",
        status: "simulated",
        fetched: posts.length,
        note: "Simulated LinkedIn feed (push live posts via Webhook Bridge / Zapier / Apify)",
      },
    };
  }

  return {
    posts: [],
    status: {
      channel: "linkedin",
      status: "bridge_needed",
      fetched: 0,
      note: options.apifyToken
        ? "Apify token ready — push LinkedIn actor results to /api/ingest/webhook"
        : "Push LinkedIn signals via Webhook Bridge (/api/ingest/webhook)",
    },
  };
}

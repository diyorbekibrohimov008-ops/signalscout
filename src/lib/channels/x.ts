import type { RawSocialPost } from "../types";
import type { ChannelFetchResponse } from "./types";

export interface XFetchOptions {
  xBearerToken?: string;
  includeSimulation?: boolean;
  fetchFn?: typeof fetch;
}

function buildSimulatedXPosts(terms: string[]): RawSocialPost[] {
  const anchor = terms[0] || "social listening";
  const now = Date.now();
  return [
    {
      channel: "x",
      externalId: `sim_x_${Buffer.from(anchor).toString("hex").slice(0, 8)}_1`,
      author: "Maya Chen",
      authorHandle: "@mayachen_saas",
      title: "",
      body: `Anyone else sick of paying $40/mo extra just to track X mentions? Looking for an alternative to Syften that handles ${anchor} without spamming our Slack.`,
      url: "https://x.com/mayachen_saas/status/1855910201",
      community: "X / SaaS Founders",
      publishedAt: new Date(now - 1000 * 60 * 18).toISOString(),
      sourceMode: "simulation",
    },
    {
      channel: "x",
      externalId: `sim_x_${Buffer.from(anchor).toString("hex").slice(0, 8)}_2`,
      author: "Growth Digest Bot",
      authorHandle: "@growthdigestbot",
      title: "",
      body: `Top 10 ${anchor} tools in 2026! Click here and use promo code GROWTH30 for 30% off #saas`,
      url: "https://x.com/growthdigestbot/status/1855910999",
      community: "X / Promo",
      publishedAt: new Date(now - 1000 * 60 * 42).toISOString(),
      sourceMode: "simulation",
    },
  ];
}

export async function fetchXPosts(terms: string[], options: XFetchOptions = {}): Promise<ChannelFetchResponse> {
  const token = options.xBearerToken?.trim();
  const fetchFn = options.fetchFn ?? fetch;
  const queryTerms = terms.map((t) => t.trim()).filter(Boolean).slice(0, 3);

  if (token && queryTerms.length > 0) {
    try {
      const q = `(${queryTerms.map((t) => `"${t}"`).join(" OR ")}) -is:retweet lang:en`;
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=15&tweet.fields=created_at,author_id`;
      const res = await fetchFn(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        return {
          posts: [],
          status: {
            channel: "x",
            status: res.status === 429 ? "rate_limited" : "error",
            fetched: 0,
            note: `X API v2 returned HTTP ${res.status}`,
          },
        };
      }
      const data = (await res.json()) as { data?: Array<{ id: string; text: string; created_at?: string; author_id?: string }> };
      const posts: RawSocialPost[] = (data.data ?? []).map((t) => ({
        channel: "x",
        externalId: t.id,
        author: t.author_id || "X user",
        authorHandle: `@user_${t.author_id || t.id}`,
        title: "",
        body: t.text,
        url: `https://x.com/i/web/status/${t.id}`,
        community: "X",
        publishedAt: t.created_at || new Date().toISOString(),
        sourceMode: "live",
      }));
      return {
        posts,
        status: { channel: "x", status: "live", fetched: posts.length, note: `Live X API v2 (${posts.length} posts)` },
      };
    } catch (err) {
      return {
        posts: [],
        status: { channel: "x", status: "error", fetched: 0, note: err instanceof Error ? err.message : "X API error" },
      };
    }
  }

  if (options.includeSimulation) {
    const posts = buildSimulatedXPosts(queryTerms);
    return {
      posts,
      status: {
        channel: "x",
        status: "simulated",
        fetched: posts.length,
        note: "Simulated X stream (connect X Bearer token or Webhook Bridge for live posts)",
      },
    };
  }

  return {
    posts: [],
    status: {
      channel: "x",
      status: "bridge_needed",
      fetched: 0,
      note: "Connect X Bearer Token or push via Webhook Bridge (/api/ingest/webhook)",
    },
  };
}

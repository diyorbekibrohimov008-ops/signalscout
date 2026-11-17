import { getEnv } from "../env";
import type { RawSocialPost } from "../types";
import type { ChannelFetchResponse } from "./types";

interface RedditListingChild {
  data?: {
    id?: string;
    author?: string;
    title?: string;
    selftext?: string;
    body?: string;
    permalink?: string;
    subreddit_name_prefixed?: string;
    created_utc?: number;
  };
}

export async function fetchRedditPosts(
  terms: string[],
  fetchFn: typeof fetch = fetch,
): Promise<ChannelFetchResponse> {
  const uniqueTerms = terms.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (uniqueTerms.length === 0) {
    return {
      posts: [],
      status: { channel: "reddit", status: "live", fetched: 0, note: "No search terms configured" },
    };
  }

  const userAgent = getEnv("REDDIT_USER_AGENT") || "SignalScout/1.0 (+https://signalscout.app)";
  const seen = new Set<string>();
  const posts: RawSocialPost[] = [];

  try {
    for (const term of uniqueTerms) {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=new&t=week&limit=15`;
      const res = await fetchFn(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });

      if (res.status === 429 || res.status === 403) {
        return {
          posts,
          status: {
            channel: "reddit",
            status: "rate_limited",
            fetched: posts.length,
            note: `Reddit returned HTTP ${res.status} (use OAuth or webhook bridge for high volume)`,
          },
        };
      }

      if (!res.ok) {
        return {
          posts,
          status: {
            channel: "reddit",
            status: "error",
            fetched: posts.length,
            note: `Reddit HTTP ${res.status}`,
          },
        };
      }

      const json = (await res.json()) as { data?: { children?: RedditListingChild[] } };
      for (const child of json.data?.children ?? []) {
        const d = child.data;
        if (!d?.id || seen.has(d.id)) continue;
        seen.add(d.id);

        const body = (d.selftext || d.body || d.title || "").trim();
        const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : `https://www.reddit.com/comments/${d.id}`;

        posts.push({
          channel: "reddit",
          externalId: d.id,
          author: d.author || "redditor",
          authorHandle: d.author ? `u/${d.author}` : "u/redditor",
          title: d.title || "",
          body,
          url: permalink,
          community: d.subreddit_name_prefixed || "Reddit",
          publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),
          sourceMode: "live",
        });
      }
    }

    return {
      posts,
      status: {
        channel: "reddit",
        status: "live",
        fetched: posts.length,
        note: `Live Reddit search (${posts.length} posts)`,
      },
    };
  } catch (err) {
    return {
      posts,
      status: {
        channel: "reddit",
        status: "error",
        fetched: posts.length,
        note: err instanceof Error ? err.message : "Reddit fetch error",
      },
    };
  }
}

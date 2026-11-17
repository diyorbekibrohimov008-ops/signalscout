import type { RawSocialPost } from "../types";
import type { ChannelFetchResponse } from "./types";

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

interface AlgoliaHit {
  objectID?: string;
  author?: string;
  title?: string;
  story_title?: string;
  story_text?: string;
  comment_text?: string;
  created_at?: string;
  _tags?: string[];
}

export async function fetchHackerNewsPosts(
  terms: string[],
  fetchFn: typeof fetch = fetch,
): Promise<ChannelFetchResponse> {
  const uniqueTerms = terms.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (uniqueTerms.length === 0) {
    return {
      posts: [],
      status: { channel: "hackernews", status: "live", fetched: 0, note: "No search terms configured" },
    };
  }

  const seen = new Set<string>();
  const posts: RawSocialPost[] = [];

  try {
    for (const term of uniqueTerms) {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=(story,comment)&hitsPerPage=15`;
      const res = await fetchFn(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) {
        return {
          posts,
          status: {
            channel: "hackernews",
            status: res.status === 429 ? "rate_limited" : "error",
            fetched: posts.length,
            note: `HN Algolia HTTP ${res.status}`,
          },
        };
      }
      const data = (await res.json()) as { hits?: AlgoliaHit[] };
      for (const hit of data.hits ?? []) {
        const id = hit.objectID;
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const isAskHn = hit._tags?.includes("ask_hn");
        const title = hit.title || hit.story_title || "";
        const body = stripHtml(hit.comment_text || hit.story_text || title);
        if (!body && !title) continue;

        posts.push({
          channel: "hackernews",
          externalId: id,
          author: hit.author || "hn_user",
          authorHandle: hit.author || "hn_user",
          title,
          body,
          url: `https://news.ycombinator.com/item?id=${id}`,
          community: isAskHn ? "Ask HN" : "Hacker News",
          publishedAt: hit.created_at || new Date().toISOString(),
          sourceMode: "live",
        });
      }
    }

    return {
      posts,
      status: {
        channel: "hackernews",
        status: "live",
        fetched: posts.length,
        note: `Live Algolia HN API (${posts.length} hits)`,
      },
    };
  } catch (err) {
    return {
      posts,
      status: {
        channel: "hackernews",
        status: "error",
        fetched: posts.length,
        note: err instanceof Error ? err.message : "HN fetch error",
      },
    };
  }
}

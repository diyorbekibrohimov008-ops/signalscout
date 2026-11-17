import { describe, expect, it } from "vitest";
import { fetchHackerNewsPosts } from "../lib/channels/hn";
import { fetchRedditPosts } from "../lib/channels/reddit";
import { fetchXPosts } from "../lib/channels/x";
import { fetchLinkedInPosts } from "../lib/channels/linkedin";

describe("Channel Crawlers (HN, Reddit, X, LinkedIn)", () => {
  it("parses Algolia Hacker News stories and comments and strips HTML tags", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              objectID: "42001",
              author: "pg_fan",
              title: "Ask HN: Best tool for Reddit monitoring?",
              story_text: "Looking to replace <p>Syften</p> with something cheaper.",
              created_at: "2026-11-10T10:00:00.000Z",
              _tags: ["story", "ask_hn"],
            },
            {
              objectID: "42002",
              author: "dev_alice",
              story_title: "Show HN: New analytics",
              comment_text: "We switched off Octolens because of <i>too much noise</i>.",
              created_at: "2026-11-10T11:00:00.000Z",
              _tags: ["comment"],
            },
          ],
        }),
        { status: 200 },
      );

    const res = await fetchHackerNewsPosts(["reddit monitoring", "syften"], mockFetch);
    expect(res.status.status).toBe("live");
    expect(res.posts).toHaveLength(2);
    expect(res.posts[0].body).not.toContain("<p>");
    expect(res.posts[1].body).not.toContain("<i>");
    expect(res.posts[0].url).toBe("https://news.ycombinator.com/item?id=42001");
  });

  it("parses Reddit search JSON and handles 429 rate limits gracefully", async () => {
    const okFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  id: "abc123",
                  author: "saas_builder",
                  title: "Anyone know a Syften alternative?",
                  selftext: "Paying $70/mo with X add-ons is wild.",
                  permalink: "/r/SaaS/comments/abc123/syften_alt/",
                  subreddit_name_prefixed: "r/SaaS",
                  created_utc: 1762800000,
                },
              },
            ],
          },
        }),
        { status: 200 },
      );

    const okRes = await fetchRedditPosts(["syften"], okFetch);
    expect(okRes.status.status).toBe("live");
    expect(okRes.posts[0].community).toBe("r/SaaS");
    expect(okRes.posts[0].url).toBe("https://www.reddit.com/r/SaaS/comments/abc123/syften_alt/");

    const rateLimitedFetch: typeof fetch = async () => new Response("Too Many Requests", { status: 429 });
    const rlRes = await fetchRedditPosts(["syften"], rateLimitedFetch);
    expect(rlRes.status.status).toBe("rate_limited");
    expect(rlRes.posts).toHaveLength(0);
  });

  it("handles X and LinkedIn with transparent bridge_needed or live provider token", async () => {
    const xBridge = await fetchXPosts(["syften"], { includeSimulation: false });
    expect(xBridge.status.status).toBe("bridge_needed");
    expect(xBridge.posts).toHaveLength(0);

    const xSim = await fetchXPosts(["syften"], { includeSimulation: true });
    expect(xSim.status.status).toBe("simulated");
    expect(xSim.posts.length).toBeGreaterThan(0);

    const liSim = await fetchLinkedInPosts(["social listening"], { includeSimulation: true });
    expect(liSim.status.status).toBe("simulated");
    expect(liSim.posts.length).toBeGreaterThan(0);
  });
});

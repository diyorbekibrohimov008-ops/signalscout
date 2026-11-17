import { describe, expect, it } from "vitest";
import { GET as vercelGet, POST as vercelPost } from "../../api/index";
import { MemoryDb } from "../lib/db";
import { handleApiRequest } from "../lib/router";

async function jsonReq(
  url: string,
  opts: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<Request> {
  const headers = new Headers();
  if (opts.body !== undefined) headers.set("Content-Type", "application/json");
  if (opts.cookie) headers.set("Cookie", opts.cookie);
  return new Request(`https://signalscout.example${url}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function extractSessionCookie(res: Response): string {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(";")[0];
}

describe("SignalScout API Router", () => {
  it("supports healthcheck and public interactive intent evaluation", async () => {
    const db = new MemoryDb();
    const healthRes = await handleApiRequest(await jsonReq("/api/health"), db);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { ok: boolean };
    expect(health.ok).toBe(true);

    const evalRes = await handleApiRequest(
      await jsonReq("/api/demo/evaluate", {
        method: "POST",
        body: {
          channel: "reddit",
          title: "Alternative to Syften without $40/mo X add-on?",
          body: "We need social listening for Reddit and X without keyword spam in Slack.",
          keywords: ["social listening"],
          competitors: ["syften"],
          productName: "SignalScout",
        },
      }),
      db,
    );
    expect(evalRes.status).toBe(200);
    const evaluated = (await evalRes.json()) as {
      analysis: { shouldAlert: boolean; confidenceScore: number };
      reply: { fullDraft: string };
      slackPayload: { blocks: unknown[] };
    };
    expect(evaluated.analysis.shouldAlert).toBe(true);
    expect(evaluated.analysis.confidenceScore).toBeGreaterThanOrEqual(75);
    expect(evaluated.reply.fullDraft).toContain("SignalScout");
    expect(evaluated.slackPayload.blocks.length).toBeGreaterThan(3);
  });

  it("registers user, sets signed session cookie, manages monitors, ingests webhooks, and upgrades billing", async () => {
    const db = new MemoryDb();

    const regRes = await handleApiRequest(
      await jsonReq("/api/auth/register", {
        method: "POST",
        body: {
          email: "founder@acme.co",
          name: "Alex",
          password: "password1234",
          companyName: "Acme AI",
          productName: "AcmePulse",
        },
      }),
      db,
    );
    expect(regRes.status).toBe(201);
    const cookie = extractSessionCookie(regRes);
    expect(cookie).toContain("ss_session=");

    const meRes = await handleApiRequest(await jsonReq("/api/auth/me", { cookie }), db);
    expect(meRes.status).toBe(200);
    const me = (await meRes.json()) as { user: { email: string }; workspace: { ingestSecret: string; plan: string } };
    expect(me.user.email).toBe("founder@acme.co");
    expect(me.workspace.plan).toBe("trial");

    // Create monitor
    const monRes = await handleApiRequest(
      await jsonReq("/api/monitors", {
        method: "POST",
        cookie,
        body: {
          name: "Acme Intent",
          keywords: ["error tracking"],
          competitors: ["sentry"],
          negativeKeywords: ["hiring"],
          channels: ["reddit", "x", "linkedin", "hackernews"],
          minConfidence: 70,
        },
      }),
      db,
    );
    expect(monRes.status).toBe(201);
    const createdMon = (await monRes.json()) as { monitor: { id: string } };

    // Push a live X post via Webhook Bridge
    const ingestRes = await handleApiRequest(
      await jsonReq(`/api/ingest/webhook?secret=${encodeURIComponent(me.workspace.ingestSecret)}`, {
        method: "POST",
        body: {
          monitorId: createdMon.monitor.id,
          posts: [
            {
              channel: "x",
              externalId: "tw_998877",
              author: "dev_jane",
              authorHandle: "@dev_jane",
              body: "Looking for an alternative to Sentry for error tracking — any recommendations?",
              url: "https://x.com/dev_jane/status/998877",
            },
          ],
        },
      }),
      db,
    );
    expect(ingestRes.status).toBe(200);

    const leadsRes = await handleApiRequest(await jsonReq("/api/leads", { cookie }), db);
    const leadsBody = (await leadsRes.json()) as { leads: Array<{ id: string; channel: string; replyDraft: string }> };
    expect(leadsBody.leads).toHaveLength(1);
    expect(leadsBody.leads[0].channel).toBe("x");
    expect(leadsBody.leads[0].replyDraft).toContain("AcmePulse");

    // Regenerate reply in technical tone
    const regenRes = await handleApiRequest(
      await jsonReq(`/api/leads/${leadsBody.leads[0].id}/regenerate-reply`, {
        method: "POST",
        cookie,
        body: { tone: "technical" },
      }),
      db,
    );
    expect(regenRes.status).toBe(200);
    const regenBody = (await regenRes.json()) as { lead: { replyTone: string } };
    expect(regenBody.lead.replyTone).toBe("technical");

    // Subscribe to $25/mo flat plan (sandbox mode when STRIPE_SECRET_KEY is unset)
    const billRes = await handleApiRequest(
      await jsonReq("/api/billing/subscribe", { method: "POST", cookie, body: {} }),
      db,
    );
    expect(billRes.status).toBe(200);
    const billData = (await billRes.json()) as { plan: string; mode: string };
    expect(billData.plan).toBe("pro_flat_25");
    expect(billData.mode).toBe("sandbox");
  });

  it("logs into 1-click demo workspace with seeded leads and noise audit", async () => {
    const db = new MemoryDb();
    const demoRes = await handleApiRequest(await jsonReq("/api/auth/demo", { method: "POST" }), db);
    expect(demoRes.status).toBe(200);
    const cookie = extractSessionCookie(demoRes);

    const leadsRes = await handleApiRequest(await jsonReq("/api/leads?filter=all", { cookie }), db);
    const data = (await leadsRes.json()) as { leads: unknown[]; noise: unknown[] };
    expect(data.leads.length).toBeGreaterThanOrEqual(3);
    expect(data.noise.length).toBeGreaterThanOrEqual(2);
  });

  it("dispatches rewritten requests through the Vercel Web API handler (api/index.ts)", async () => {
    const healthRes = await vercelGet(new Request("https://signalscout.vercel.app/api/index?__route=health"));
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { ok: boolean; service: string };
    expect(health.ok).toBe(true);
    expect(health.service).toBe("SignalScout");

    const demoRes = await vercelPost(
      new Request("https://signalscout.vercel.app/api/index?__route=auth/demo", { method: "POST" }),
    );
    expect(demoRes.status).toBe(200);
  });
});

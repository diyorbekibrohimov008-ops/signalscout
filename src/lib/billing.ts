import { createHmac, timingSafeEqual } from "node:crypto";
import type { SignalScoutDb } from "./db";
import { getEnv } from "./env";
import type { WorkspaceRecord } from "./types";

export const FLAT_PLAN_PRICE_CENTS = 2500;

export interface SubscribeResult {
  mode: "stripe" | "sandbox";
  plan: WorkspaceRecord["plan"];
  checkoutUrl?: string;
}

export async function subscribeFlat25(
  db: SignalScoutDb,
  workspace: WorkspaceRecord,
  origin: string,
  fetchFn: typeof fetch = fetch,
): Promise<SubscribeResult> {
  const stripeKey = getEnv("STRIPE_SECRET_KEY");
  const priceId = getEnv("STRIPE_PRICE_ID_FLAT_25");

  if (stripeKey && priceId) {
    const form = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=canceled`,
      "metadata[workspace_id]": workspace.id,
      client_reference_id: workspace.id,
    });

    const res = await fetchFn("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe Checkout failed (${res.status}): ${text}`);
    }

    const session = (await res.json()) as { url?: string; id?: string };
    return {
      mode: "stripe",
      plan: workspace.plan,
      checkoutUrl: session.url,
    };
  }

  await db.updateWorkspace(workspace.id, { plan: "pro_flat_25" });
  await db.insertBillingEvent({
    workspaceId: workspace.id,
    eventType: "subscription_activated",
    amountCents: FLAT_PLAN_PRICE_CENTS,
    description: "Activated All-Channel Flat Plan ($25/mo — Reddit, X, LinkedIn, HN included; Sandbox mode)",
  });

  return {
    mode: "sandbox",
    plan: "pro_flat_25",
  };
}

export async function cancelSubscription(db: SignalScoutDb, workspace: WorkspaceRecord): Promise<WorkspaceRecord | null> {
  const updated = await db.updateWorkspace(workspace.id, { plan: "canceled" });
  await db.insertBillingEvent({
    workspaceId: workspace.id,
    eventType: "subscription_canceled",
    amountCents: 0,
    description: "Canceled All-Channel Flat Plan ($25/mo)",
  });
  return updated;
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

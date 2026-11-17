import React, { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { api } from "../api";
import type { BillingResponse } from "../types";
import { formatRelativeTime } from "./badges";

interface BillingViewProps {
  onRefresh: () => Promise<void>;
}

export function BillingView({ onRefresh }: BillingViewProps) {
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const data = await api.getBilling();
      setBilling(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBilling();
  }, []);

  const handleSubscribe = async () => {
    setActing(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api.subscribeFlat25();
      if (res.mode === "stripe" && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      await loadBilling();
      await onRefresh();
      setNotice("Activated $25/mo All-Channel Flat plan! All 4 channels and cron polling are enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription update failed");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    setActing(true);
    setNotice(null);
    setError(null);
    try {
      await api.cancelPlan();
      await loadBilling();
      await onRefresh();
      setNotice("Plan marked as canceled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel plan");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading billing state...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">All-Channel Flat Plan ($25/mo)</h1>
        <p className="text-xs text-slate-400">
          One transparent price covering Reddit, X, LinkedIn, and Hacker News &mdash; zero surprise add-on invoices.
        </p>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Current Status: {billing?.plan === "pro_flat_25" ? "Active ($25/mo Flat)" : billing?.plan === "trial" ? "14-Day Free Trial" : "Canceled"}
              </span>
              <h2 className="mt-2 text-2xl font-bold text-white">
                $25 <span className="text-sm font-normal text-slate-400">/ month flat</span>
              </h2>
            </div>
            <CreditCard className="h-6 w-6 text-emerald-400" />
          </div>

          <ul className="grid sm:grid-cols-2 gap-2.5 text-xs text-slate-200">
            {[
              "Reddit + Hacker News live polling",
              "X (Twitter) included ($0 add-on)",
              "LinkedIn signals + webhook ingest",
              "LLM buying-intent noise filter",
              "Contextual Slack reply outlines",
              "Instant Slack & Discord delivery",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
            {billing?.plan !== "pro_flat_25" ? (
              <button
                type="button"
                disabled={acting}
                onClick={handleSubscribe}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer"
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {billing?.stripeConfigured ? "Subscribe via Stripe Checkout ($25/mo)" : "Activate $25/mo Flat Plan"}
              </button>
            ) : (
              <button
                type="button"
                disabled={acting}
                onClick={handleCancel}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-rose-950/50 hover:text-rose-200 px-4 py-2 text-xs font-semibold text-slate-300 transition cursor-pointer"
              >
                Cancel Subscription
              </button>
            )}
            {!billing?.stripeConfigured ? (
              <span className="text-[11px] text-slate-500">
                Sandbox billing active (set STRIPE_SECRET_KEY in Netlify env to switch to live Stripe Checkout).
              </span>
            ) : null}
          </div>
        </div>

        {/* Comparison card */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Your Savings vs Legacy Channel Add-Ons</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Syften Base (Web / Reddit)</span>
              <span className="font-mono text-slate-200">$29.95/mo</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Syften X / Twitter Add-On</span>
              <span className="font-mono text-rose-300">+$40.00/mo</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-semibold">Comparable Legacy Total</span>
              <span className="font-mono font-bold text-rose-300">$69.95/mo</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-emerald-300 font-semibold">SignalScout Flat Plan</span>
              <span className="font-mono text-lg font-bold text-emerald-400">$25.00/mo</span>
            </div>
          </div>
          <p className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-[11px] text-slate-400">
            Save <strong className="text-emerald-300">$539.40/year</strong> while blocking low-intent noise and getting
            non-salesy reply drafts right inside Slack.
          </p>
        </div>
      </div>

      {/* Billing Ledger */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Billing &amp; Plan History</h3>
        {billing?.events.length ? (
          <div className="divide-y divide-slate-800 text-xs">
            {billing.events.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-medium text-slate-200">{ev.description}</p>
                  <p className="text-[11px] text-slate-500">{ev.eventType}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-white">
                    {ev.amountCents > 0 ? `$${(ev.amountCents / 100).toFixed(2)}` : "$0.00"}
                  </p>
                  <p className="text-[11px] text-slate-500">{formatRelativeTime(ev.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No billing events recorded yet.</p>
        )}
      </div>
    </div>
  );
}

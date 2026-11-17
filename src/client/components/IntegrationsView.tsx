import React, { useState } from "react";
import { BellRing, Check, Copy, KeyRound, Loader2, Save, Send, Webhook } from "lucide-react";
import { api } from "../api";
import type { ReplyTone, SanitizedWorkspace } from "../types";

interface IntegrationsViewProps {
  workspace: SanitizedWorkspace;
  onRefresh: () => Promise<void>;
}

export function IntegrationsView({ workspace, onRefresh }: IntegrationsViewProps) {
  const [productName, setProductName] = useState(workspace.productName);
  const [productDescription, setProductDescription] = useState(workspace.productDescription);
  const [productUrl, setProductUrl] = useState(workspace.productUrl);
  const [idealCustomer, setIdealCustomer] = useState(workspace.idealCustomer);
  const [defaultTone, setDefaultTone] = useState<ReplyTone>(workspace.defaultTone);

  const [slackWebhookUrl, setSlackWebhookUrl] = useState(workspace.slackWebhookUrl);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(workspace.discordWebhookUrl);
  const [customOpenaiKey, setCustomOpenaiKey] = useState(workspace.customOpenaiKeySet ? "***" : "");
  const [xBearerToken, setXBearerToken] = useState(workspace.xBearerTokenSet ? "***" : "");

  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [pushingBridge, setPushingBridge] = useState(false);
  const [copiedIngest, setCopiedIngest] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ingestUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/ingest/webhook?secret=${workspace.ingestSecret}`
      : `/api/ingest/webhook?secret=${workspace.ingestSecret}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await api.updateSettings({
        productName,
        productDescription,
        productUrl,
        idealCustomer,
        defaultTone,
        slackWebhookUrl,
        discordWebhookUrl,
        customOpenaiKey,
        xBearerToken,
      });
      await onRefresh();
      setNotice("Saved product context, webhooks, and channel keys.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setNotice(null);
    setError(null);
    try {
      await api.updateSettings({ slackWebhookUrl, discordWebhookUrl });
      const res = await api.testWebhook();
      if (res.ok) {
        setNotice("Test alert delivered! Check your Slack/Discord channel for the Block Kit reply card.");
      } else {
        setError(res.dispatch.errors.join("; ") || "Webhook test returned an error.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Webhook test failed");
    } finally {
      setTestingWebhook(false);
    }
  };

  const handlePushSampleWebhook = async () => {
    setPushingBridge(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api.ingestWebhookSample(workspace.ingestSecret, {
        channel: "linkedin",
        author: "Elena Rostova",
        authorHandle: "in/elena-rostova-saas",
        title: "Looking for a Syften alternative with Slack reply drafts",
        body: "Anyone switched from Syften or Octolens recently? Paying extra for X mentions plus manual Slack triage is burning too much founder time. Looking for recommendations.",
        community: "LinkedIn B2B Feed",
      });
      await onRefresh();
      setNotice(
        `Webhook bridge ingested 1 LinkedIn post (${res.scanRun.highIntentMatched} matched as high intent — check Intent Inbox).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge ingest failed");
    } finally {
      setPushingBridge(false);
    }
  };

  const copyIngestUrl = async () => {
    try {
      await navigator.clipboard.writeText(ingestUrl);
      setCopiedIngest(true);
      setTimeout(() => setCopiedIngest(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Slack, Discord &amp; Brand Context</h1>
        <p className="text-xs text-slate-400">
          Connect real Slack/Discord webhooks, configure Reply Assistant product context, or push X/LinkedIn events via
          our zero-markup webhook bridge.
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

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-12">
        {/* Product context */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Save className="h-4 w-4 text-emerald-400" />
            Product Context (Used by Reply Assistant)
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Product URL</label>
              <input
                type="text"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Product Summary</label>
            <textarea
              rows={3}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Ideal Customer</label>
              <input
                type="text"
                value={idealCustomer}
                onChange={(e) => setIdealCustomer(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Default Reply Tone</label>
              <select
                value={defaultTone}
                onChange={(e) => setDefaultTone(e.target.value as ReplyTone)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="founder">Founder (transparent)</option>
                <option value="peer">Peer Builder</option>
                <option value="technical">Technical Architect</option>
              </select>
            </div>
          </div>
        </div>

        {/* Slack / Discord & BYOK keys */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <BellRing className="h-4 w-4 text-cyan-400" />
            Alert Delivery &amp; Channel Tokens
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Slack Incoming Webhook URL</label>
            <input
              type="url"
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Discord Webhook URL</label>
            <input
              type="url"
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-300">
                <KeyRound className="h-3 w-3 text-slate-400" />
                X API v2 Bearer Token (Optional)
              </label>
              <input
                type="password"
                value={xBearerToken}
                onChange={(e) => setXBearerToken(e.target.value)}
                placeholder="AAAA..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-300">
                <KeyRound className="h-3 w-3 text-slate-400" />
                Custom OpenAI Key (Optional BYOK)
              </label>
              <input
                type="password"
                value={customOpenaiKey}
                onChange={(e) => setCustomOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2 text-xs font-bold text-slate-950 transition cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save All Settings
            </button>

            <button
              type="button"
              disabled={testingWebhook}
              onClick={handleTestWebhook}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              {testingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send Test Alert
            </button>
          </div>
        </div>
      </form>

      {/* X & LinkedIn Webhook Bridge */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Webhook className="h-4 w-4 text-emerald-400" />
              Zero-Markup X &amp; LinkedIn Webhook Ingest Bridge
            </div>
            <p className="text-xs text-slate-400">
              Pipe X/LinkedIn mentions from Zapier, Make, n8n, or Apify directly into SignalScout&apos;s LLM intent
              filter + Slack Reply Assistant without paying $40/mo channel add-ons.
            </p>
          </div>
          <button
            type="button"
            disabled={pushingBridge}
            onClick={handlePushSampleWebhook}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition cursor-pointer"
          >
            {pushingBridge ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Test Webhook Ingest (Sample LinkedIn Lead)
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
          <code className="flex-1 truncate font-mono text-xs text-emerald-300">
            POST {ingestUrl}
          </code>
          <button
            type="button"
            onClick={copyIngestUrl}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            {copiedIngest ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copiedIngest ? "Copied" : "Copy URL"}
          </button>
        </div>
      </div>
    </div>
  );
}

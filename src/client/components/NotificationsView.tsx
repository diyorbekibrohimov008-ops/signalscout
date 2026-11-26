import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Loader2, Send } from "lucide-react";
import { api } from "../api";
import type { LeadRecord, SanitizedWorkspace } from "../types";
import { SlackPreview } from "./SlackPreview";

interface NotificationsViewProps {
  workspace: SanitizedWorkspace;
  sampleLead: LeadRecord | null;
  onRefresh: () => Promise<void>;
}

export function NotificationsView({ workspace, sampleLead, onRefresh }: NotificationsViewProps) {
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(workspace.slackWebhookUrl);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(workspace.discordWebhookUrl);
  const [xBearerToken, setXBearerToken] = useState(workspace.xBearerTokenSet ? "***" : "");
  const [customOpenaiKey, setCustomOpenaiKey] = useState(workspace.customOpenaiKeySet ? "***" : "");

  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [pushingBridge, setPushingBridge] = useState(false);
  const [copiedIngest, setCopiedIngest] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setSlackWebhookUrl(workspace.slackWebhookUrl);
    setDiscordWebhookUrl(workspace.discordWebhookUrl);
    setXBearerToken(workspace.xBearerTokenSet ? "***" : "");
    setCustomOpenaiKey(workspace.customOpenaiKeySet ? "***" : "");
  }, [workspace.id, workspace.slackWebhookUrl, workspace.discordWebhookUrl, workspace.xBearerTokenSet, workspace.customOpenaiKeySet]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

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
        slackWebhookUrl,
        discordWebhookUrl,
        xBearerToken,
        customOpenaiKey,
      });
      await onRefresh();
      setNotice("Saved notification settings.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notification settings.");
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
        setNotice("Test notification sent. Check your Slack or Discord channel.");
      } else {
        setError(res.dispatch.errors.join("; ") || "Notification test returned an error.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notification test failed.");
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
        community: "LinkedIn Feed",
      });
      await onRefresh();
      setNotice(
        `Sent 1 sample LinkedIn post through the bridge (${res.scanRun.highIntentMatched} added to Leads).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send sample post.");
    } finally {
      setPushingBridge(false);
    }
  };

  const copyIngestUrl = async () => {
    try {
      await navigator.clipboard.writeText(ingestUrl);
      setCopiedIngest(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedIngest(false);
        copyTimerRef.current = null;
      }, 1800);
    } catch {
      setError("Clipboard blocked. Copy the URL directly from the box.");
    }
  };

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8 sm:px-6 space-y-8">
      <header className="max-w-2xl space-y-1.5">
        <h1 className="font-serif text-2xl font-semibold text-[#161B26]">Notifications</h1>
        <p className="text-sm text-[#525D70] leading-relaxed">
          Send new leads and their reply drafts straight to Slack or Discord whenever a high-intent post is found.
        </p>
      </header>

      {notice ? (
        <div className="rounded-md border border-[#BDE0CE] bg-[#F1F9F5] px-4 py-3 text-[13.5px] text-[#1B6E4F]">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-[13.5px] text-[#9B1C1C]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <form
          onSubmit={handleSave}
          className="lg:col-span-6 rounded-md border border-[#DDE2EB] bg-white p-5 sm:p-6 space-y-5"
        >
          <div>
            <h2 className="text-[15px] font-semibold text-[#161B26]">Slack and Discord alerts</h2>
            <p className="mt-1 text-xs text-[#525D70] leading-relaxed">
              Paste an incoming webhook link from your Slack workspace or Discord server. Only posts that pass the
              buying-intent filter are sent.
            </p>
          </div>

          <div>
            <label htmlFor="slack-url" className="block text-xs font-medium text-[#3B4557] mb-1">
              Slack incoming webhook URL
            </label>
            <input
              id="slack-url"
              type="url"
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          <div>
            <label htmlFor="discord-url" className="block text-xs font-medium text-[#3B4557] mb-1">
              Discord webhook URL
            </label>
            <input
              id="discord-url"
              type="url"
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-[#2553B8] hover:bg-[#1D4499] disabled:opacity-60 px-4 py-2 text-sm font-medium text-white cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save notifications
            </button>

            <button
              type="button"
              disabled={testingWebhook}
              onClick={() => void handleTestWebhook()}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-3.5 py-2 text-sm font-medium text-[#161B26] cursor-pointer"
            >
              {testingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-[#525D70]" />}
              Send test notification
            </button>
          </div>

          {/* Tucked away for developers & power users */}
          <details className="border-t border-[#EFF2F6] pt-4 group">
            <summary className="flex items-center justify-between text-xs font-medium text-[#525D70] hover:text-[#161B26] cursor-pointer list-none">
              <span>Advanced developer options (inbound webhooks &amp; API keys)</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#161B26]">Inbound webhook bridge for X &amp; LinkedIn</p>
                <p className="text-xs text-[#525D70] leading-relaxed">
                  Forward posts from Zapier, Make, n8n, or Apify into this workspace using a POST request.
                </p>
                <div className="flex items-center gap-2 rounded-md border border-[#DDE2EB] bg-[#F8F9FB] px-3 py-2">
                  <code className="flex-1 truncate font-mono text-[11.5px] text-[#161B26]">
                    POST {ingestUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyIngestUrl()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#2553B8] hover:underline shrink-0 cursor-pointer"
                  >
                    {copiedIngest ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedIngest ? "Copied" : "Copy"}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={pushingBridge}
                  onClick={() => void handlePushSampleWebhook()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-3 py-1.5 text-xs font-medium text-[#161B26] cursor-pointer"
                >
                  {pushingBridge ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Send sample LinkedIn post to bridge
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#EFF2F6] pt-4">
                <div>
                  <label htmlFor="x-token" className="block text-xs font-medium text-[#3B4557] mb-1">
                    X API v2 Bearer Token (optional)
                  </label>
                  <input
                    id="x-token"
                    type="password"
                    value={xBearerToken}
                    onChange={(e) => setXBearerToken(e.target.value)}
                    placeholder="AAAA..."
                    className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-1.5 text-xs text-[#161B26]"
                  />
                </div>
                <div>
                  <label htmlFor="openai-key" className="block text-xs font-medium text-[#3B4557] mb-1">
                    Custom OpenAI API key (optional)
                  </label>
                  <input
                    id="openai-key"
                    type="password"
                    value={customOpenaiKey}
                    onChange={(e) => setCustomOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-1.5 text-xs text-[#161B26]"
                  />
                </div>
              </div>
            </div>
          </details>
        </form>

        {/* Right: Calm preview of what a notification looks like */}
        <div className="lg:col-span-6 space-y-3">
          <h2 className="text-[15px] font-semibold text-[#161B26]">What an alert looks like in Slack</h2>
          <p className="text-xs text-[#525D70]">
            Every notification includes the original post, a short note explaining why it matched, and a reply draft
            ready to copy.
          </p>
          <SlackPreview
            channel={sampleLead?.channel ?? "reddit"}
            intentType={sampleLead?.intentType ?? "competitor_complaint"}
            confidenceScore={sampleLead?.confidenceScore ?? 93}
            buyingUrgency={sampleLead?.buyingUrgency ?? "high"}
            community={sampleLead?.community ?? "r/SaaS"}
            authorHandle={sampleLead?.authorHandle ?? "u/saas_kyle"}
            title={
              sampleLead?.title ??
              "Looking for an alternative to Syften — X add-on pricing is getting out of hand"
            }
            body={
              sampleLead?.body ??
              "We've been paying $29.95/mo for basic Reddit + $40/mo just for X monitoring and still get flooded with false positives."
            }
            reasoning={
              sampleLead?.reasoning ??
              "Author expresses frustration with an incumbent monitoring tool's pricing, noise, or workflow."
            }
            replyDraft={
              sampleLead?.replyDraft ??
              "Totally hear you on channel add-on pricing — paying extra per channel only to still dig through false positives is exhausting."
            }
            replyTone={sampleLead?.replyTone ?? workspace.defaultTone}
            url={sampleLead?.url}
          />
        </div>
      </div>
    </div>
  );
}

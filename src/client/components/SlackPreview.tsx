import React, { useState } from "react";
import { Check, Copy, ExternalLink, Hash, Sparkles } from "lucide-react";
import type { BuyingUrgency, Channel, IntentType, ReplyTone } from "../types";
import { CHANNEL_META, INTENT_META } from "./badges";

interface SlackPreviewProps {
  channel: Channel;
  intentType: IntentType;
  confidenceScore: number;
  buyingUrgency: BuyingUrgency;
  monitorName?: string;
  community: string;
  authorHandle: string;
  title?: string;
  body: string;
  reasoning: string;
  replyDraft: string;
  replyTone: ReplyTone;
  url?: string;
  suppressed?: boolean;
}

export function SlackPreview({
  channel,
  intentType,
  confidenceScore,
  buyingUrgency,
  monitorName = "Buying-Intent Radar",
  community,
  authorHandle,
  title,
  body,
  reasoning,
  replyDraft,
  replyTone,
  url,
  suppressed = false,
}: SlackPreviewProps) {
  const [copied, setCopied] = useState(false);

  const channelLabel = CHANNEL_META[channel].label;
  const intentLabel = INTENT_META[intentType].label;
  const excerpt = body.length > 320 ? `${body.slice(0, 317)}...` : body;

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(replyDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be blocked in restricted contexts
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-lg overflow-hidden">
      {/* Slack channel top chrome */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Hash className="h-3.5 w-3.5 text-slate-400" />
          <span>buying-intent-alerts</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            Slack Block Kit Preview
          </span>
        </div>
        {suppressed ? (
          <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
            Suppressed — Not Sent to Slack
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
            Instant Slack Alert
          </span>
        )}
      </div>

      {/* Slack message card */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 text-slate-950 font-bold text-sm">
            SS
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">SignalScout</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                APP
              </span>
              <span className="text-xs text-slate-500">just now</span>
            </div>

            <div
              className={`border-l-4 pl-3 space-y-2.5 ${
                suppressed ? "border-slate-700 opacity-75" : "border-emerald-400"
              }`}
            >
              <div className="text-sm font-bold text-slate-100">
                {channelLabel} &bull; {intentLabel} ({confidenceScore}/100)
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Monitor: </span>
                  <span className="text-slate-200">{monitorName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Source: </span>
                  <span className="text-slate-200">
                    {community || channelLabel} ({authorHandle})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Urgency: </span>
                  <span className="uppercase text-slate-200 font-semibold">{buyingUrgency}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Confidence: </span>
                  <span className="text-slate-200 font-semibold">{confidenceScore}/100</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 p-3 text-xs text-slate-300 space-y-1">
                {title ? <p className="font-semibold text-slate-100">{title}</p> : null}
                <p className="whitespace-pre-line leading-relaxed text-slate-300">&gt; {excerpt}</p>
              </div>

              <div className="flex items-start gap-1.5 text-xs text-slate-400">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                <p>
                  <span className="font-medium text-slate-300">Why this passed LLM filter: </span>
                  {reasoning}
                </p>
              </div>

              {!suppressed && (
                <div className="border-t border-slate-800 pt-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-300">
                      Contextual Reply Outline ({replyTone} tone &mdash; edit &amp; post in seconds):
                    </span>
                    <button
                      type="button"
                      onClick={copyDraft}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy Draft"}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
                    {replyDraft}
                  </pre>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition"
                    >
                      Open Thread
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

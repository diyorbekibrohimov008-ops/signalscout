import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Hash } from "lucide-react";
import type { BuyingUrgency, Channel, IntentType, ReplyTone } from "../types";
import { CHANNEL_META, INTENT_META, safeExternalHref } from "./badges";

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
  monitorName = "Syften & Octolens Switchers",
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
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const channelLabel = CHANNEL_META[channel].label;
  const intentLabel = INTENT_META[intentType].label;
  const excerpt = body.length > 260 ? `${body.slice(0, 257)}...` : body;
  const href = safeExternalHref(url);

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(replyDraft);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="rounded-md border border-[#DDE2EB] bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#DDE2EB] bg-[#F8F9FB] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-[#3B4557] font-medium">
          <Hash className="h-3.5 w-3.5 text-[#525D70]" />
          <span>buying-intent-alerts</span>
        </div>
        <span className={suppressed ? "text-[#525D70]" : "text-[#1B6E4F] font-medium"}>
          {suppressed ? "Kept quiet" : "Sample Slack message"}
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-[#161B26]">SignalScout</span>
          <span className="text-xs text-[#525D70]">just now</span>
        </div>

        <div
          className={`border-l-2 pl-4 space-y-3 ${
            suppressed ? "border-[#DDE2EB] opacity-75" : "border-[#2553B8]"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13.5px] font-semibold text-[#161B26]">
              {channelLabel} — {intentLabel}
            </p>
            <span className="tabular-nums text-xs text-[#525D70]">{confidenceScore} / 100</span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <dt className="inline text-[#525D70]">Topic: </dt>
              <dd className="inline text-[#161B26] font-medium">{monitorName}</dd>
            </div>
            <div>
              <dt className="inline text-[#525D70]">Source: </dt>
              <dd className="inline text-[#161B26]">
                {community || channelLabel} ({authorHandle})
              </dd>
            </div>
            <div>
              <dt className="inline text-[#525D70]">Urgency: </dt>
              <dd className="inline capitalize text-[#161B26] font-medium">{buyingUrgency}</dd>
            </div>
          </dl>

          <div className="rounded bg-[#F8F9FB] border border-[#EFF2F6] p-3 text-[13px] text-[#242D3D] space-y-1">
            {title ? <p className="font-semibold text-[#161B26]">{title}</p> : null}
            <p className="leading-relaxed">{excerpt}</p>
          </div>

          <p className="text-xs text-[#525D70]">
            <span className="font-medium text-[#161B26]">Why it matched: </span>
            {reasoning}
          </p>

          {!suppressed ? (
            <div className="border-t border-[#EFF2F6] pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#161B26]">
                  Reply draft ({replyTone} tone)
                </span>
                <button
                  type="button"
                  onClick={() => void copyDraft()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2553B8] hover:underline cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="whitespace-pre-line rounded bg-[#F8F9FB] border border-[#EFF2F6] p-3 text-xs leading-relaxed text-[#242D3D]">
                {replyDraft}
              </p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2553B8] hover:underline"
                >
                  Open original thread
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

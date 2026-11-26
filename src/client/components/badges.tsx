import React from "react";
import type { BuyingUrgency, Channel, IntentType } from "../types";

export const CHANNEL_META: Record<Channel, { label: string; short: string; textClass: string; dotClass: string }> = {
  reddit: {
    label: "Reddit",
    short: "Reddit",
    textClass: "text-[#9A3412]",
    dotClass: "bg-[#C2410C]",
  },
  x: {
    label: "X",
    short: "X",
    textClass: "text-[#1E3A5F]",
    dotClass: "bg-[#1E3A5F]",
  },
  linkedin: {
    label: "LinkedIn",
    short: "LinkedIn",
    textClass: "text-[#1D4ED8]",
    dotClass: "bg-[#1D4ED8]",
  },
  hackernews: {
    label: "Hacker News",
    short: "HN",
    textClass: "text-[#92400E]",
    dotClass: "bg-[#B45309]",
  },
};

export const INTENT_META: Record<IntentType, { label: string; toneClass: string }> = {
  recommendation_request: {
    label: "Asking for recommendations",
    toneClass: "text-[#1B6E4F]",
  },
  competitor_complaint: {
    label: "Unhappy with a competitor",
    toneClass: "text-[#9A4B16]",
  },
  explicit_buying_intent: {
    label: "Ready to buy or switch",
    toneClass: "text-[#2553B8]",
  },
  noise_or_irrelevant: {
    label: "Filtered out",
    toneClass: "text-[#525D70]",
  },
};

export const URGENCY_META: Record<BuyingUrgency, { label: string; textClass: string }> = {
  high: { label: "High urgency", textClass: "text-[#9A4B16]" },
  medium: { label: "Medium urgency", textClass: "text-[#161B26]" },
  low: { label: "Low urgency", textClass: "text-[#525D70]" },
};

export function ChannelTag({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function safeExternalHref(rawUrl: string | undefined | null): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

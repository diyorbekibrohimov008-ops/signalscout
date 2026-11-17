import React from "react";
import type { BuyingUrgency, Channel, IntentType } from "../types";

export const CHANNEL_META: Record<Channel, { label: string; badgeClass: string; short: string }> = {
  reddit: {
    label: "Reddit",
    short: "Reddit",
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  x: {
    label: "X (Twitter)",
    short: "X",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  linkedin: {
    label: "LinkedIn",
    short: "LinkedIn",
    badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  hackernews: {
    label: "Hacker News",
    short: "HN",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
};

export const INTENT_META: Record<IntentType, { label: string; badgeClass: string }> = {
  recommendation_request: {
    label: "Recommendation Request",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  competitor_complaint: {
    label: "Competitor Complaint",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  explicit_buying_intent: {
    label: "Explicit Buying Intent",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  noise_or_irrelevant: {
    label: "Filtered Noise",
    badgeClass: "bg-slate-800 text-slate-400 border-slate-700",
  },
};

export const URGENCY_META: Record<BuyingUrgency, { label: string; className: string }> = {
  high: { label: "High urgency", className: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  medium: { label: "Medium urgency", className: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  low: { label: "Low urgency", className: "text-slate-400 bg-slate-800/70 border-slate-700" },
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

export function IntentBadge({ intent }: { intent: IntentType }) {
  const meta = INTENT_META[intent];
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
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

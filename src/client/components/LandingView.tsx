import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  DollarSign,
  Filter,
  Loader2,
  MessageSquareReply,
  Radio,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "../api";
import type { Channel, DemoEvaluateResponse, ReplyTone } from "../types";
import { ChannelBadge, IntentBadge } from "./badges";
import { SlackPreview } from "./SlackPreview";

interface LandingViewProps {
  onOpenAuth: (mode: "login" | "register") => void;
  onAuthenticated: () => Promise<void>;
}

interface PresetScenario {
  id: string;
  label: string;
  channel: Channel;
  authorHandle: string;
  title: string;
  body: string;
  keywords: string;
  competitors: string;
  negativeKeywords: string;
}

const PRESETS: PresetScenario[] = [
  {
    id: "syften_switch",
    label: "Syften Price Complaint (Reddit)",
    channel: "reddit",
    authorHandle: "u/saas_founder_mike",
    title: "Anyone switching away from Syften? X/Twitter add-on pricing is getting crazy",
    body: "We like fast Reddit keyword alerts, but paying $29.95 base plus another $40/mo add-on just for X mentions and wading through spammy Slack notifications is painful. Looking for a solid alternative with built-in AI filtering.",
    keywords: "social listening, monitoring, slack alerts",
    competitors: "syften, octolens",
    negativeKeywords: "hiring, internship",
  },
  {
    id: "octolens_noise",
    label: "Recommendation Request (Hacker News)",
    channel: "hackernews",
    authorHandle: "devtools_lead",
    title: "Ask HN: Best tool to monitor Reddit, HN, and LinkedIn for buying intent without Slack noise?",
    body: "Simple keyword matching floods our team Slack channel with 200 irrelevant developer threads a day. Anyone using an LLM-filtered listener that only alerts when someone actually wants a tool recommendation?",
    keywords: "buying intent, monitor reddit, social listening",
    competitors: "syften, octolens",
    negativeKeywords: "crypto, giveaway",
  },
  {
    id: "seo_noise",
    label: "Spam / Listicle Noise (Blocked!)",
    channel: "linkedin",
    authorHandle: "@growth_newsletter",
    title: "Top 15 best social listening tools you MUST follow in 2026 [Mega Thread]",
    body: "Check out our blog post round-up! Subscribe to our newsletter and enter our giveaway for free promo codes. Monitoring keywords is a top SaaS marketing trend.",
    keywords: "social listening, monitoring",
    competitors: "syften, octolens",
    negativeKeywords: "giveaway, top 15",
  },
  {
    id: "explicit_buyer",
    label: "Explicit Q4 Budget Buyer (X)",
    channel: "x",
    authorHandle: "@vpgrowth_nina",
    title: "",
    body: "Evaluating social listening tools for our B2B demand gen team with budget approved this week. Need Reddit + X + LinkedIn alerts in Slack plus draft replies so founders don't sound like bots. What should we buy?",
    keywords: "social listening, reddit alerts, slack",
    competitors: "syften, octolens",
    negativeKeywords: "hiring",
  },
];

export function LandingView({ onOpenAuth, onAuthenticated }: LandingViewProps) {
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Add-on calculator state
  const [calcRedditHn, setCalcRedditHn] = useState(true);
  const [calcX, setCalcX] = useState(true);
  const [calcLinkedIn, setCalcLinkedIn] = useState(true);
  const [calcYouTube, setCalcYouTube] = useState(false);

  const syftenCost =
    (calcRedditHn ? 29.95 : 0) +
    (calcX ? 40 : 0) +
    (calcYouTube ? 20 : 0);
  const signalScoutCost = 25;
  const monthlySavings = Math.max(0, syftenCost - signalScoutCost);

  // Interactive Playground state
  const [activePresetId, setActivePresetId] = useState<string>(PRESETS[0].id);
  const [channel, setChannel] = useState<Channel>(PRESETS[0].channel);
  const [authorHandle, setAuthorHandle] = useState(PRESETS[0].authorHandle);
  const [title, setTitle] = useState(PRESETS[0].title);
  const [body, setBody] = useState(PRESETS[0].body);
  const [keywords, setKeywords] = useState(PRESETS[0].keywords);
  const [competitors, setCompetitors] = useState(PRESETS[0].competitors);
  const [tone, setTone] = useState<ReplyTone>("founder");
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<DemoEvaluateResponse | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const runPlaygroundEval = async (override?: Partial<PresetScenario> & { tone?: ReplyTone }) => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const res = await api.evaluateDemo({
        channel: override?.channel ?? channel,
        authorHandle: override?.authorHandle ?? authorHandle,
        title: override?.title ?? title,
        body: override?.body ?? body,
        keywords: (override?.keywords ?? keywords)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        competitors: (override?.competitors ?? competitors)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        tone: override?.tone ?? tone,
      });
      setEvalResult(res);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "Failed to evaluate post");
    } finally {
      setEvalLoading(false);
    }
  };

  useEffect(() => {
    void runPlaygroundEval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPreset = (preset: PresetScenario) => {
    setActivePresetId(preset.id);
    setChannel(preset.channel);
    setAuthorHandle(preset.authorHandle);
    setTitle(preset.title);
    setBody(preset.body);
    setKeywords(preset.keywords);
    setCompetitors(preset.competitors);
    void runPlaygroundEval(preset);
  };

  const handleLaunchDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      await api.launchDemo();
      await onAuthenticated();
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Unable to start demo");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
              <Radio className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">SignalScout</span>
            <span className="hidden sm:inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              $25/mo Flat All-Channel
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <a href="#playground" className="hover:text-white transition">
              Live Intent Filter
            </a>
            <a href="#pricing-calc" className="hover:text-white transition">
              Add-On Calculator
            </a>
            <a href="#comparison" className="hover:text-white transition">
              Syften &amp; Octolens Switch Guide
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenAuth("login")}
              className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth("register")}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition cursor-pointer"
            >
              Start 14-Day Trial
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-10 sm:px-6 lg:pt-16">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3.5 py-1.5 text-xs text-slate-300">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span>Built for teams switching from Syften &amp; Octolens</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-tight">
            Buying-intent listening across every channel for{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              $25/mo flat
            </span>
            .
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-400 leading-relaxed">
            Stop paying <strong className="text-slate-200">$40/mo extra just for X/Twitter</strong> or drowning
            your Slack channel in keyword noise. SignalScout filters mentions with LLM intent detection and puts a{" "}
            <strong className="text-slate-200">non-salesy contextual reply draft</strong> straight inside your alert.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              disabled={demoLoading}
              onClick={handleLaunchDemo}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Launch Live Demo Workspace
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#playground"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 transition"
            >
              <Filter className="h-4 w-4 text-emerald-400" />
              Test the LLM Noise Filter
            </a>
          </div>

          {demoError ? (
            <p className="text-xs text-rose-400">{demoError}</p>
          ) : null}

          {/* 3 Core Pillars */}
          <div className="grid gap-4 pt-8 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wide">
                <DollarSign className="h-4 w-4" />
                Zero Channel Add-Ons
              </div>
              <p className="text-sm font-semibold text-white">Reddit, X, LinkedIn &amp; HN for $25/mo</p>
              <p className="text-xs text-slate-400">
                One predictable flat plan instead of stacked per-network upgrades.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wide">
                <ShieldAlert className="h-4 w-4" />
                2-Stage LLM Noise Shield
              </div>
              <p className="text-sm font-semibold text-white">Only high-intent threads reach Slack</p>
              <p className="text-xs text-slate-400">
                Blocks promotional listicles, spam, and chatter while logging what was suppressed.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wide">
                <MessageSquareReply className="h-4 w-4" />
                Reply Assistant in Slack
              </div>
              <p className="text-sm font-semibold text-white">Helpful 3-part outline ready in seconds</p>
              <p className="text-xs text-slate-400">
                Hook + peer advice + transparent soft disclosure so you never sound like a corporate shill.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Playground */}
      <section id="playground" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-8 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Bot className="h-3.5 w-3.5" />
                Live Backend Pipeline Test
              </span>
              <h2 className="mt-1 text-2xl font-bold text-white">
                See the LLM Intent Filter &amp; Slack Reply Assistant in action
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    activePresetId === p.id
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left input form */}
            <div className="lg:col-span-5 space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as Channel)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <option value="reddit">Reddit</option>
                    <option value="hackernews">Hacker News</option>
                    <option value="x">X (Twitter)</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Reply Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => {
                      const nextTone = e.target.value as ReplyTone;
                      setTone(nextTone);
                      void runPlaygroundEval({ tone: nextTone });
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <option value="founder">Founder (transparent)</option>
                    <option value="peer">Peer Builder</option>
                    <option value="technical">Technical Architect</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Thread Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Social Post Content</label>
                <textarea
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Tracked Keywords</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Competitors</label>
                  <input
                    type="text"
                    value={competitors}
                    onChange={(e) => setCompetitors(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={evalLoading}
                onClick={() => void runPlaygroundEval()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer"
              >
                {evalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Run Stage 1 Pre-Filter + LLM Classifier
              </button>

              {evalError ? <p className="text-xs text-rose-400">{evalError}</p> : null}

              {evalResult ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-300">Pipeline Verdict:</span>
                    <div className="flex items-center gap-1.5">
                      <ChannelBadge channel={channel} />
                      <IntentBadge intent={evalResult.analysis.intentType} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>
                      Stage 1 Keyword Gate:{" "}
                      <strong className={evalResult.stage1.passed ? "text-emerald-300" : "text-rose-300"}>
                        {evalResult.stage1.passed ? "PASSED" : "BLOCKED"}
                      </strong>
                    </span>
                    <span>Confidence: {evalResult.analysis.confidenceScore}/100</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {evalResult.stage1.passed ? evalResult.analysis.reasoning : evalResult.stage1.reason}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Right Slack preview */}
            <div className="lg:col-span-7">
              {evalResult ? (
                <SlackPreview
                  channel={channel}
                  intentType={evalResult.analysis.intentType}
                  confidenceScore={evalResult.analysis.confidenceScore}
                  buyingUrgency={evalResult.analysis.buyingUrgency}
                  community={channel === "reddit" ? "r/SaaS" : channel === "hackernews" ? "Ask HN" : channel.toUpperCase()}
                  authorHandle={authorHandle}
                  title={title}
                  body={body}
                  reasoning={evalResult.analysis.reasoning}
                  replyDraft={evalResult.reply.fullDraft}
                  replyTone={evalResult.reply.tone}
                  suppressed={!evalResult.analysis.shouldAlert}
                />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 text-sm text-slate-500">
                  Running live classifier...
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Channel Add-On Cost Calculator */}
      <section id="pricing-calc" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Channel Add-On Calculator
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Stop paying add-on taxes for each social channel
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Syften starts at $29.95/mo for basic web &amp; Reddit alerts, then charges an extra{" "}
              <strong className="text-slate-200">$40/mo add-on for X/Twitter</strong> and{" "}
              <strong className="text-slate-200">$20/mo for YouTube</strong>. Select the channels your team monitors
              to compare monthly cost.
            </p>

            <div className="space-y-2.5 pt-2">
              {[
                { label: "Reddit & Hacker News ($29.95/mo Syften base)", checked: calcRedditHn, set: setCalcRedditHn },
                { label: "X / Twitter Monitoring (+$40.00/mo Syften add-on)", checked: calcX, set: setCalcX },
                { label: "LinkedIn Signals (Included $0 in SignalScout)", checked: calcLinkedIn, set: setCalcLinkedIn },
                { label: "YouTube Mentions (+$20.00/mo Syften add-on)", checked: calcYouTube, set: setCalcYouTube },
              ].map((item) => (
                <label
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 cursor-pointer hover:border-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.set(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-medium text-slate-400">Syften w/ selected add-ons</p>
                <p className="mt-2 text-3xl font-bold text-rose-300">${syftenCost.toFixed(2)}</p>
                <p className="mt-1 text-[11px] text-slate-500">per month + manual reply writing</p>
              </div>
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <p className="text-xs font-medium text-emerald-300">SignalScout Flat Plan</p>
                <p className="mt-2 text-3xl font-bold text-white">$25.00</p>
                <p className="mt-1 text-[11px] text-emerald-300/80">
                  Reddit + X + LinkedIn + HN included
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Estimated Annual Savings Switching</p>
                <p className="text-xl font-bold text-emerald-400">
                  ${(monthlySavings * 12).toFixed(0)}/year saved
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth("register")}
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer"
              >
                Lock In $25/mo Flat
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Switching Comparison Table */}
      <section id="comparison" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-white">Why teams switch to SignalScout</h2>
          <p className="mt-1 text-sm text-slate-400">
            Keep fast Reddit &amp; HN alerts plus X and LinkedIn &mdash; without Slack noise or corporate-sounding replies.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Capability</th>
                <th className="px-5 py-4 text-emerald-300">SignalScout</th>
                <th className="px-5 py-4">Syften</th>
                <th className="px-5 py-4">Octolens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs sm:text-sm">
              {[
                {
                  feature: "Base + Full Channel Pricing",
                  ss: "$25/mo flat (all 4 channels)",
                  syften: "$29.95 base + $40 X + $20 YT",
                  octolens: "Tiered seat/volume plans",
                },
                {
                  feature: "Reddit & Hacker News Live Polling",
                  ss: "Included + 10-min cron",
                  syften: "Included",
                  octolens: "Included",
                },
                {
                  feature: "X (Twitter) & LinkedIn Support",
                  ss: "$0 add-on (X API + Webhook bridge)",
                  syften: "$40/mo X add-on required",
                  octolens: "Plan-gated",
                },
                {
                  feature: "Pre-Slack LLM Buying-Intent Filter",
                  ss: "2-stage gate + Noise Audit Log",
                  syften: "Mostly keyword rules",
                  octolens: "AI relevance scoring",
                },
                {
                  feature: "Contextual Reply Outline in Slack",
                  ss: "Yes (Hook + Value + Soft Disclosure)",
                  syften: "Manual outreach",
                  octolens: "Alert-first workflow",
                },
              ].map((row) => (
                <tr key={row.feature} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3.5 font-medium text-white">{row.feature}</td>
                  <td className="px-5 py-3.5 text-emerald-300 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {row.ss}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">{row.syften}</td>
                  <td className="px-5 py-3.5 text-slate-400">{row.octolens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500">
        SignalScout &bull; All-Channel Buying-Intent Listening ($25/mo flat) &bull; Built on Netlify Functions + Postgres + Cron
      </footer>
    </div>
  );
}

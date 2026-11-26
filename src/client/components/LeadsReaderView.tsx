import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import { api } from "../api";
import type {
  Channel,
  DemoEvaluateResponse,
  LeadRecord,
  LeadStatus,
  MonitorRecord,
  ReplyTone,
  ScanRunRecord,
  WorkspaceStats,
} from "../types";
import {
  CHANNEL_META,
  ChannelTag,
  formatRelativeTime,
  INTENT_META,
  safeExternalHref,
  URGENCY_META,
} from "./badges";

interface LeadsReaderViewProps {
  leads: LeadRecord[];
  noise: LeadRecord[];
  stats: WorkspaceStats;
  monitors: MonitorRecord[];
  scanRuns: ScanRunRecord[];
  scanMessage: string | null;
  scanError: string | null;
  onScanNow: () => void;
  scanning: boolean;
  onRefresh: () => Promise<void>;
  onGoToNotifications: () => void;
}

interface TestPreset {
  id: string;
  label: string;
  channel: Channel;
  authorHandle: string;
  title: string;
  body: string;
  keywords: string;
  competitors: string;
}

const TEST_PRESETS: TestPreset[] = [
  {
    id: "syften",
    label: "Competitor frustration (Reddit)",
    channel: "reddit",
    authorHandle: "u/saas_founder_mike",
    title: "Anyone switching away from Syften? X add-on pricing is getting crazy",
    body: "We like fast Reddit alerts, but paying $29.95 base plus another $40/mo just for X mentions and wading through spammy Slack notifications is painful. Looking for a solid alternative with built-in filtering.",
    keywords: "social listening, monitoring",
    competitors: "syften, octolens",
  },
  {
    id: "hn",
    label: "Asking for advice (Hacker News)",
    channel: "hackernews",
    authorHandle: "devtools_lead",
    title: "Ask HN: Best tool to monitor Reddit, HN, and LinkedIn for buying intent?",
    body: "Simple keyword matching floods our team Slack channel with 200 irrelevant threads a day. Anyone using a filtered reader that only alerts when someone actually wants a tool recommendation?",
    keywords: "buying intent, social listening",
    competitors: "syften, octolens",
  },
  {
    id: "spam",
    label: "Promotional noise (should be filtered)",
    channel: "linkedin",
    authorHandle: "@growth_newsletter",
    title: "Top 15 best social listening tools you MUST follow in 2026",
    body: "Just published a guide on our blog! Subscribe to our newsletter and use promo code SAVE20 for affiliate discounts.",
    keywords: "social listening, monitoring",
    competitors: "syften, octolens",
  },
];

export function LeadsReaderView({
  leads,
  noise,
  monitors,
  scanRuns,
  scanMessage,
  scanError,
  onScanNow,
  scanning,
  onRefresh,
  onGoToNotifications,
}: LeadsReaderViewProps) {
  const [listMode, setListMode] = useState<"leads" | "filtered" | "test">("leads");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id ?? null);

  // Draft editing state
  const [draftEdit, setDraftEdit] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [regenTone, setRegenTone] = useState<ReplyTone>("founder");
  const [regenerating, setRegenerating] = useState(false);
  const [sendingSlack, setSendingSlack] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Interactive "Test a post" evaluator state
  const [testPresetId, setTestPresetId] = useState(TEST_PRESETS[0].id);
  const [testChannel, setTestChannel] = useState<Channel>(TEST_PRESETS[0].channel);
  const [testTitle, setTestTitle] = useState(TEST_PRESETS[0].title);
  const [testBody, setTestBody] = useState(TEST_PRESETS[0].body);
  const [testKeywords, setTestKeywords] = useState(TEST_PRESETS[0].keywords);
  const [testCompetitors, setTestCompetitors] = useState(TEST_PRESETS[0].competitors);
  const [testTone, setTestTone] = useState<ReplyTone>("founder");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<DemoEvaluateResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const evalSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const filteredLeads = useMemo(() => {
    const source = listMode === "filtered" ? noise : leads;
    return source.filter((item) => {
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;
      if (listMode === "leads" && statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [listMode, leads, noise, channelFilter, statusFilter]);

  const selectedLead = useMemo(
    () => filteredLeads.find((l) => l.id === selectedLeadId) ?? filteredLeads[0] ?? null,
    [filteredLeads, selectedLeadId],
  );

  useEffect(() => {
    if (selectedLead) {
      setDraftEdit(selectedLead.replyDraft);
      setRegenTone(selectedLead.replyTone);
      setActionNotice(null);
      setActionError(null);
    }
  }, [selectedLead?.id, selectedLead?.replyDraft, selectedLead?.replyTone]);

  const monitorNameById = useMemo(() => {
    const map = new Map<string, string>();
    monitors.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [monitors]);

  const runTestEvaluation = async (override?: Partial<TestPreset> & { tone?: ReplyTone }) => {
    const reqId = ++evalSeqRef.current;
    setTestLoading(true);
    setTestError(null);
    try {
      const res = await api.evaluateDemo({
        channel: override?.channel ?? testChannel,
        title: override?.title ?? testTitle,
        body: override?.body ?? testBody,
        authorHandle: override?.authorHandle,
        keywords: (override?.keywords ?? testKeywords)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        competitors: (override?.competitors ?? testCompetitors)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        tone: override?.tone ?? testTone,
      });
      if (reqId === evalSeqRef.current) {
        setTestResult(res);
      }
    } catch (err) {
      if (reqId === evalSeqRef.current) {
        setTestError(err instanceof Error ? err.message : "Could not evaluate post.");
      }
    } finally {
      if (reqId === evalSeqRef.current) {
        setTestLoading(false);
      }
    }
  };

  useEffect(() => {
    if (listMode === "test" && !testResult && !testLoading) {
      void runTestEvaluation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listMode]);

  const handleSelectPreset = (preset: TestPreset) => {
    setTestPresetId(preset.id);
    setTestChannel(preset.channel);
    setTestTitle(preset.title);
    setTestBody(preset.body);
    setTestKeywords(preset.keywords);
    setTestCompetitors(preset.competitors);
    void runTestEvaluation(preset);
  };

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await api.updateLead(leadId, { status });
      await onRefresh();
      setActionNotice(status === "replied" ? "Marked as replied." : "Dismissed from your active leads.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update lead status.");
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedLead) return;
    setSavingDraft(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await api.updateLead(selectedLead.id, { replyDraft: draftEdit });
      await onRefresh();
      setActionNotice("Saved your edits to this reply draft.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save reply draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleRegenerate = async (tone: ReplyTone) => {
    if (!selectedLead) return;
    setRegenTone(tone);
    setRegenerating(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await api.regenerateReply(selectedLead.id, tone);
      setDraftEdit(res.lead.replyDraft);
      await onRefresh();
      setActionNotice(`Rewrote reply in ${tone} tone.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not rewrite reply.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSendSlack = async () => {
    if (!selectedLead) return;
    setSendingSlack(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await api.sendLeadToSlack(selectedLead.id);
      await onRefresh();
      const channels: string[] = [];
      if (res.dispatch.slackSent) channels.push("Slack");
      if (res.dispatch.discordSent) channels.push("Discord");
      if (channels.length > 0) {
        setActionNotice(`Sent lead and reply draft to ${channels.join(" and ")}.`);
      } else {
        setActionError(res.dispatch.errors.join("; ") || "Notification delivery did not succeed.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not send notification.");
    } finally {
      setSendingSlack(false);
    }
  };

  const handleCopyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1800);
    } catch {
      setActionError("Clipboard access was blocked by the browser. Select the text to copy manually.");
    }
  };

  const latestScan = scanRuns[0] ?? null;
  const originalHref = selectedLead ? safeExternalHref(selectedLead.url) : null;

  const renderMarginNotes = (lead: LeadRecord) => {
    const intent = INTENT_META[lead.intentType];
    const urgency = URGENCY_META[lead.buyingUrgency];
    const topicName = monitorNameById.get(lead.monitorId) ?? "Active topic";

    return (
      <div className="space-y-6 text-[13px] leading-relaxed">
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold text-[#161B26]">
            {lead.isFilteredNoise ? "Why this was filtered out" : "Why this was flagged"}
          </h3>
          <p className="text-[#3B4557]">{lead.reasoning}</p>
        </section>

        {lead.painPoints.length > 0 ? (
          <section className="border-t border-[#DDE2EB] pt-4 space-y-2">
            <h3 className="text-xs font-semibold text-[#161B26]">Signals noticed</h3>
            <ul className="space-y-1.5 text-[#3B4557]">
              {lead.painPoints.map((pt) => (
                <li key={pt} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 rounded-full bg-[#2553B8] shrink-0" aria-hidden="true" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-t border-[#DDE2EB] pt-4 space-y-2.5">
          <h3 className="text-xs font-semibold text-[#161B26]">Reading details</h3>
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#525D70]">Match score</dt>
              <dd className="tabular-nums font-semibold text-[#161B26]">{lead.confidenceScore} / 100</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#525D70]">Intent</dt>
              <dd className={`font-medium text-right ${intent.toneClass}`}>{intent.label}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#525D70]">Urgency</dt>
              <dd className={`font-medium ${urgency.textClass}`}>{urgency.label}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#525D70]">Topic</dt>
              <dd className="text-[#161B26] text-right truncate max-w-[155px]" title={topicName}>
                {topicName}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#525D70]">Status</dt>
              <dd className="text-[#161B26] capitalize">{lead.status}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#525D70]">Notifications</dt>
              <dd className="text-[#525D70]">
                {lead.alertSentSlack || lead.alertSentDiscord ? "Sent" : "Not sent yet"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Scan status notices */}
      {scanMessage ? (
        <div className="border-b border-[#DDE2EB] bg-[#EBF1FC] px-4 py-2.5 sm:px-6 text-[13px] text-[#1D4499] flex flex-wrap items-center justify-between gap-2">
          <span>{scanMessage}</span>
          {latestScan?.channelStatuses ? (
            <span className="text-xs text-[#3B4557] tabular-nums">
              {Object.values(latestScan.channelStatuses)
                .map((cs) => `${CHANNEL_META[cs.channel]?.short ?? cs.channel}: ${cs.fetched}`)
                .join(", ")}
            </span>
          ) : null}
        </div>
      ) : null}

      {scanError ? (
        <div className="border-b border-[#F2C6C6] bg-[#FDF2F2] px-4 py-2.5 sm:px-6 text-[13px] text-[#9B1C1C]">
          {scanError}
        </div>
      ) : null}

      {/* 3-Zone Research Reader: Left Reading List | Center Document (68ch) | Right Margin Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-[296px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)_272px] min-h-[calc(100vh-105px)]">
        {/* LEFT RAIL: Reading List */}
        <aside className="min-w-0 border-b lg:border-b-0 lg:border-r border-[#DDE2EB] bg-[#F8F9FB] flex flex-col">
          <div className="p-3.5 border-b border-[#DDE2EB] space-y-3 bg-white">
            {/* View toggle: Leads | Filtered out | Test a post */}
            <div className="flex items-center gap-1 border border-[#DDE2EB] rounded-md p-0.5 bg-[#F8F9FB] text-xs font-medium">
              <button
                type="button"
                onClick={() => setListMode("leads")}
                className={`flex-1 rounded px-2 py-1.5 transition-colors cursor-pointer ${
                  listMode === "leads"
                    ? "bg-white text-[#161B26] shadow-2xs"
                    : "text-[#525D70] hover:text-[#161B26]"
                }`}
              >
                Leads ({leads.length})
              </button>
              <button
                type="button"
                onClick={() => setListMode("filtered")}
                className={`flex-1 rounded px-2 py-1.5 transition-colors cursor-pointer ${
                  listMode === "filtered"
                    ? "bg-white text-[#161B26] shadow-2xs"
                    : "text-[#525D70] hover:text-[#161B26]"
                }`}
              >
                Filtered ({noise.length})
              </button>
              <button
                type="button"
                onClick={() => setListMode("test")}
                title="Paste any post to test the filter"
                className={`inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 transition-colors cursor-pointer ${
                  listMode === "test"
                    ? "bg-white text-[#2553B8] shadow-2xs"
                    : "text-[#525D70] hover:text-[#161B26]"
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                <span>Test</span>
              </button>
            </div>

            {listMode !== "test" ? (
              <div className="flex items-center gap-2 min-w-0">
                <label className="sr-only" htmlFor="channel-filter">
                  Filter by channel
                </label>
                <select
                  id="channel-filter"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as Channel | "all")}
                  className="min-w-0 flex-1 rounded-md border border-[#DDE2EB] bg-white px-2.5 py-1.5 text-xs text-[#161B26]"
                >
                  <option value="all">All channels</option>
                  <option value="reddit">Reddit</option>
                  <option value="hackernews">Hacker News</option>
                  <option value="x">X</option>
                  <option value="linkedin">LinkedIn</option>
                </select>

                {listMode === "leads" ? (
                  <>
                    <label className="sr-only" htmlFor="status-filter">
                      Filter by status
                    </label>
                    <select
                      id="status-filter"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
                      className="min-w-0 rounded-md border border-[#DDE2EB] bg-white px-2.5 py-1.5 text-xs text-[#161B26]"
                    >
                      <option value="all">All statuses</option>
                      <option value="new">New</option>
                      <option value="replied">Replied</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-[#525D70] leading-relaxed">
                Pick a sample below or paste your own post to see why SignalScout flags or ignores it.
              </p>
            )}
          </div>

          {/* Reading list items OR Test presets */}
          {listMode === "test" ? (
            <div className="divide-y divide-[#DDE2EB]">
              {TEST_PRESETS.map((preset) => {
                const active = testPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer border-l-2 ${
                      active
                        ? "border-l-[#2553B8] bg-[#EBF1FC]/60"
                        : "border-l-transparent hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <ChannelTag channel={preset.channel} />
                    </div>
                    <p className="text-[13.5px] font-medium text-[#161B26] leading-snug">
                      {preset.label}
                    </p>
                    <p className="mt-1 text-xs text-[#525D70] line-clamp-2">{preset.body}</p>
                  </button>
                );
              })}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm font-medium text-[#161B26]">No posts match this view yet.</p>
              <p className="text-xs text-[#525D70] leading-relaxed">
                Run a scan to pull fresh Reddit and Hacker News discussions, or switch the filter back to all channels.
              </p>
              <button
                type="button"
                disabled={scanning}
                onClick={onScanNow}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#EFF2F6] px-3 py-1.5 text-xs font-medium text-[#161B26] cursor-pointer"
              >
                Scan for new posts
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#DDE2EB] lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
              {filteredLeads.map((lead) => {
                const selected = selectedLead?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLeadId(lead.id)}
                    aria-pressed={selected}
                    className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer border-l-2 ${
                      selected
                        ? "border-l-[#2553B8] bg-[#EBF1FC]/65"
                        : "border-l-transparent hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <ChannelTag channel={lead.channel} />
                      <span className="tabular-nums text-[11.5px] font-medium text-[#525D70]">
                        {lead.confidenceScore}/100
                      </span>
                    </div>

                    <p className="text-[14px] font-medium text-[#161B26] leading-snug line-clamp-1 lg:line-clamp-2">
                      {lead.title || lead.body}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-[#525D70]">
                      <span className="truncate">{lead.community || lead.authorHandle}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {lead.status === "replied" ? (
                          <span className="text-[#1B6E4F] font-medium">Replied</span>
                        ) : lead.status === "dismissed" && !lead.isFilteredNoise ? (
                          <span className="text-[#525D70]">Dismissed</span>
                        ) : null}
                        <span className="tabular-nums">{formatRelativeTime(lead.publishedAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* CENTER COLUMN: Readable Document + Reply Draft (or Test a Post) */}
        <article className="bg-white px-4 py-6 sm:px-10 sm:py-9 min-w-0">
          {listMode === "test" ? (
            <div className="reading-measure mx-auto space-y-6">
              <div>
                <h1 className="font-serif text-2xl text-[#161B26] font-semibold">
                  Test how SignalScout reads a post
                </h1>
                <p className="mt-1.5 text-sm text-[#525D70] leading-relaxed">
                  Paste any Reddit, X, LinkedIn, or Hacker News post to see whether it passes the noise filter and what
                  reply draft it produces.
                </p>
              </div>

              <div className="space-y-4 border-t border-[#DDE2EB] pt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="test-channel" className="block text-xs font-medium text-[#3B4557] mb-1">
                      Channel
                    </label>
                    <select
                      id="test-channel"
                      value={testChannel}
                      onChange={(e) => setTestChannel(e.target.value as Channel)}
                      className="w-full rounded-md border border-[#DDE2EB] bg-white px-3 py-2 text-sm text-[#161B26]"
                    >
                      <option value="reddit">Reddit</option>
                      <option value="hackernews">Hacker News</option>
                      <option value="x">X</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="test-tone" className="block text-xs font-medium text-[#3B4557] mb-1">
                      Reply tone
                    </label>
                    <select
                      id="test-tone"
                      value={testTone}
                      onChange={(e) => {
                        const next = e.target.value as ReplyTone;
                        setTestTone(next);
                        void runTestEvaluation({ tone: next });
                      }}
                      className="w-full rounded-md border border-[#DDE2EB] bg-white px-3 py-2 text-sm text-[#161B26]"
                    >
                      <option value="founder">Founder</option>
                      <option value="peer">Peer</option>
                      <option value="technical">Technical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="test-title" className="block text-xs font-medium text-[#3B4557] mb-1">
                    Post title (optional)
                  </label>
                  <input
                    id="test-title"
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    className="w-full rounded-md border border-[#DDE2EB] bg-white px-3 py-2 text-sm text-[#161B26]"
                  />
                </div>

                <div>
                  <label htmlFor="test-body" className="block text-xs font-medium text-[#3B4557] mb-1">
                    Post text
                  </label>
                  <textarea
                    id="test-body"
                    rows={4}
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    className="w-full rounded-md border border-[#DDE2EB] bg-white px-3 py-2 text-sm leading-relaxed text-[#161B26]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="test-kw" className="block text-xs font-medium text-[#3B4557] mb-1">
                      Words to watch
                    </label>
                    <input
                      id="test-kw"
                      type="text"
                      value={testKeywords}
                      onChange={(e) => setTestKeywords(e.target.value)}
                      className="w-full rounded-md border border-[#DDE2EB] bg-white px-3 py-2 text-sm text-[#161B26]"
                    />
                  </div>
                  <div>
                    <label htmlFor="test-comp" className="block text-xs font-medium text-[#3B4557] mb-1">
                      Competitors
                    </label>
                    <input
                      id="test-comp"
                      type="text"
                      value={testCompetitors}
                      onChange={(e) => setTestCompetitors(e.target.value)}
                      className="w-full rounded-md border border-[#DDE2EB] bg-white px-3 py-2 text-sm text-[#161B26]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={testLoading}
                    onClick={() => void runTestEvaluation()}
                    className="inline-flex items-center gap-2 rounded-md bg-[#2553B8] hover:bg-[#1D4499] disabled:opacity-60 px-4 py-2 text-sm font-medium text-white cursor-pointer"
                  >
                    {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Evaluate this post
                  </button>
                  {testError ? <span className="text-xs text-[#9B1C1C]">{testError}</span> : null}
                </div>
              </div>

              {testResult ? (
                <div className="border-t border-[#DDE2EB] pt-6 space-y-5">
                  <div className="rounded-md border border-[#DDE2EB] bg-[#F8F9FB] p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          testResult.analysis.shouldAlert ? "text-[#1B6E4F]" : "text-[#525D70]"
                        }`}
                      >
                        {testResult.analysis.shouldAlert
                          ? "Flagged as a lead — would notify you"
                          : "Filtered out — kept quiet"}
                      </span>
                      <span className="tabular-nums text-xs font-medium text-[#525D70]">
                        Score: {testResult.analysis.confidenceScore} / 100
                      </span>
                    </div>
                    <p className="text-[13.5px] text-[#3B4557] leading-relaxed">
                      {testResult.stage1.passed ? testResult.analysis.reasoning : testResult.stage1.reason}
                    </p>
                  </div>

                  {testResult.analysis.shouldAlert ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-[#161B26]">Suggested reply draft</h2>
                        <button
                          type="button"
                          onClick={() => void handleCopyText(testResult.reply.fullDraft)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2553B8] hover:underline cursor-pointer"
                        >
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? "Copied" : "Copy draft"}
                        </button>
                      </div>
                      <div className="rounded-md border border-[#DDE2EB] bg-[#F8F9FB] p-4 text-[14px] leading-relaxed text-[#161B26] whitespace-pre-line">
                        {testResult.reply.fullDraft}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : selectedLead ? (
            <div className="reading-measure mx-auto space-y-7">
              {/* Document Header */}
              <header className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#525D70]">
                    <ChannelTag channel={selectedLead.channel} />
                    {selectedLead.community ? <span>{selectedLead.community}</span> : null}
                    <span>{selectedLead.authorHandle || selectedLead.author}</span>
                    <span className="tabular-nums">{formatRelativeTime(selectedLead.publishedAt)}</span>
                  </div>

                  {originalHref ? (
                    <a
                      href={originalHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2553B8] hover:underline shrink-0"
                    >
                      <span>Open post</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>

                <h1 className="font-serif text-[24px] sm:text-[28px] leading-[1.28] font-semibold text-[#161B26] tracking-[-0.01em]">
                  {selectedLead.title || `Post by ${selectedLead.authorHandle || selectedLead.author}`}
                </h1>
              </header>

              {/* Readable Post Body */}
              <section
                aria-label="Original post content"
                className="border-l-2 border-[#DDE2EB] pl-5 text-[16px] leading-[1.75] text-[#242D3D] whitespace-pre-line"
              >
                {selectedLead.body}
              </section>

              {/* Mobile / Medium inline Margin Notes (moves to right column on xl) */}
              <aside
                aria-label="Margin notes"
                className="xl:hidden rounded-md border border-[#DDE2EB] bg-[#F8F9FB] p-5"
              >
                {renderMarginNotes(selectedLead)}
              </aside>

              {/* Ready-to-edit Reply Draft */}
              {!selectedLead.isFilteredNoise ? (
                <section aria-label="Reply draft" className="border-t border-[#DDE2EB] pt-6 space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-[15px] font-semibold text-[#161B26]">Ready-to-edit reply draft</h2>
                      <p className="text-[13px] text-[#525D70] mt-0.5">
                        Edit this draft before posting, or switch the tone to match your voice.
                      </p>
                    </div>

                    <div
                      role="group"
                      aria-label="Reply tone"
                      className="inline-flex items-center rounded-md border border-[#DDE2EB] bg-[#F8F9FB] p-0.5 text-xs font-medium"
                    >
                      {(["founder", "peer", "technical"] as ReplyTone[]).map((tone) => (
                        <button
                          key={tone}
                          type="button"
                          disabled={regenerating}
                          onClick={() => void handleRegenerate(tone)}
                          className={`rounded px-2.5 py-1 capitalize transition-colors cursor-pointer ${
                            regenTone === tone
                              ? "bg-white text-[#2553B8] shadow-2xs"
                              : "text-[#525D70] hover:text-[#161B26]"
                          }`}
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label htmlFor="reply-draft-editor" className="sr-only">
                    Reply draft text
                  </label>
                  <textarea
                    id="reply-draft-editor"
                    rows={10}
                    value={draftEdit}
                    onChange={(e) => setDraftEdit(e.target.value)}
                    className="w-full rounded-md border border-[#CFD7E3] bg-[#FCFDFE] focus:bg-white focus:border-[#2553B8] p-4 text-[14.5px] leading-[1.68] text-[#161B26] transition-colors"
                  />

                  {actionNotice ? (
                    <div className="rounded-md border border-[#BDE0CE] bg-[#F1F9F5] px-3.5 py-2 text-[13px] text-[#1B6E4F]">
                      {actionNotice}
                    </div>
                  ) : null}

                  {actionError ? (
                    <div className="rounded-md border border-[#F2C6C6] bg-[#FDF2F2] px-3.5 py-2 text-[13px] text-[#9B1C1C] flex flex-wrap items-center justify-between gap-2">
                      <span>{actionError}</span>
                      {actionError.toLowerCase().includes("notifications") ? (
                        <button
                          type="button"
                          onClick={onGoToNotifications}
                          className="font-medium underline cursor-pointer"
                        >
                          Open Notifications
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleCopyText(draftEdit)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#2553B8] hover:bg-[#1D4499] px-4 py-2 text-[13px] font-medium text-white transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied reply" : "Copy reply"}
                    </button>

                    <button
                      type="button"
                      disabled={savingDraft || draftEdit === selectedLead.replyDraft}
                      onClick={() => void handleSaveDraft()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] disabled:opacity-45 px-3.5 py-2 text-[13px] font-medium text-[#161B26] transition-colors cursor-pointer"
                    >
                      {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Save edits
                    </button>

                    <button
                      type="button"
                      disabled={sendingSlack}
                      onClick={() => void handleSendSlack()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-3.5 py-2 text-[13px] font-medium text-[#161B26] transition-colors cursor-pointer"
                    >
                      {sendingSlack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-[#525D70]" />}
                      Send to Slack
                    </button>

                    <div className="flex items-center gap-2 sm:ml-auto">
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(selectedLead.id, "replied")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F1F9F5] hover:border-[#BDE0CE] hover:text-[#1B6E4F] px-3 py-2 text-[13px] font-medium text-[#3B4557] transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark replied
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleStatusChange(selectedLead.id, "dismissed")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-3 py-2 text-[13px] font-medium text-[#525D70] transition-colors cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="border-t border-[#DDE2EB] pt-5 text-[13.5px] text-[#525D70]">
                  This post was filtered out automatically so it never interrupts your Slack channel or reading list.
                </section>
              )}
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
              <p className="font-serif text-lg text-[#161B26]">Select a post from the left to read it</p>
              <p className="text-sm text-[#525D70] leading-relaxed">
                SignalScout shows the original discussion, explains in the margin why it matched, and prepares a reply
                you can edit before posting.
              </p>
            </div>
          )}
        </article>

        {/* RIGHT RAIL: Quiet Margin Notes (Desktop xl) */}
        <aside
          aria-label="Margin notes"
          className="hidden xl:block border-l border-[#DDE2EB] bg-[#F8F9FB] px-6 py-9"
        >
          {listMode === "test" ? (
            testResult ? (
              <div className="space-y-5 text-[13px] leading-relaxed">
                <section className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-[#161B26]">Filter decision</h3>
                  <p className="text-[#3B4557]">
                    {testResult.stage1.passed ? testResult.analysis.reasoning : testResult.stage1.reason}
                  </p>
                </section>
                <section className="border-t border-[#DDE2EB] pt-4 space-y-2 text-[12.5px]">
                  <div className="flex justify-between">
                    <span className="text-[#525D70]">Keyword check</span>
                    <span className="font-medium text-[#161B26]">
                      {testResult.stage1.passed ? "Passed" : "Blocked"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#525D70]">Match score</span>
                    <span className="tabular-nums font-medium text-[#161B26]">
                      {testResult.analysis.confidenceScore} / 100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#525D70]">Intent</span>
                    <span className="font-medium text-[#161B26] text-right">
                      {INTENT_META[testResult.analysis.intentType].label}
                    </span>
                  </div>
                </section>
              </div>
            ) : (
              <p className="text-xs text-[#525D70]">Run an evaluation to see margin notes here.</p>
            )
          ) : selectedLead ? (
            renderMarginNotes(selectedLead)
          ) : (
            <p className="text-xs text-[#525D70]">
              Margin notes explaining why a post was flagged appear here when you open a lead.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

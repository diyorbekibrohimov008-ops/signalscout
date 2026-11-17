import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCw,
  Send,
  ShieldBan,
  Sparkles,
  XCircle,
} from "lucide-react";
import { api } from "../api";
import type {
  Channel,
  LeadRecord,
  LeadStatus,
  MonitorRecord,
  ReplyTone,
  ScanRunRecord,
  WorkspaceStats,
} from "../types";
import { ChannelBadge, formatRelativeTime, IntentBadge, URGENCY_META } from "./badges";

interface InboxViewProps {
  leads: LeadRecord[];
  noise: LeadRecord[];
  stats: WorkspaceStats;
  monitors: MonitorRecord[];
  scanRuns: ScanRunRecord[];
  onRefresh: () => Promise<void>;
}

export function InboxView({ leads, noise, stats, monitors, scanRuns, onRefresh }: InboxViewProps) {
  const [subTab, setSubTab] = useState<"intent" | "noise">("intent");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id ?? null);

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<ScanRunRecord | null>(scanRuns[0] ?? null);

  const [draftEdit, setDraftEdit] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [regenTone, setRegenTone] = useState<ReplyTone>("founder");
  const [regenerating, setRegenerating] = useState(false);
  const [sendingSlack, setSendingSlack] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    const source = subTab === "intent" ? leads : noise;
    return source.filter((item) => {
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;
      if (subTab === "intent" && statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [subTab, leads, noise, channelFilter, statusFilter]);

  const selectedLead = useMemo(
    () => filteredLeads.find((l) => l.id === selectedLeadId) ?? filteredLeads[0] ?? null,
    [filteredLeads, selectedLeadId],
  );

  useEffect(() => {
    if (selectedLead) {
      setDraftEdit(selectedLead.replyDraft);
      setRegenTone(selectedLead.replyTone);
    }
  }, [selectedLead?.id, selectedLead?.replyDraft, selectedLead?.replyTone]);

  const monitorNameById = useMemo(() => {
    const map = new Map<string, string>();
    monitors.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [monitors]);

  const handleRunScan = async () => {
    setScanning(true);
    setScanMessage(null);
    setActionError(null);
    try {
      const res = await api.runScan({ includeSimulation: true });
      const latest = res.runs[0] ?? null;
      setLastRun(latest);
      await onRefresh();
      const totalMatched = res.runs.reduce((acc, r) => acc + r.highIntentMatched, 0);
      const totalFetched = res.runs.reduce((acc, r) => acc + r.postsFetched, 0);
      const totalBlocked = res.runs.reduce((acc, r) => acc + r.stage1Dropped + r.llmFilteredNoise, 0);
      setScanMessage(
        `Scan complete: ${totalFetched} posts inspected, ${totalBlocked} noise blocked, ${totalMatched} new high-intent lead(s).`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await api.updateLead(leadId, { status });
      await onRefresh();
      setActionNotice(`Marked lead as ${status}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update lead");
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
      setActionNotice("Saved customized reply draft.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save draft");
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
      setActionNotice(`Regenerated reply in ${tone} tone.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to regenerate reply");
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
      const parts: string[] = [];
      if (res.dispatch.slackSent) parts.push("Slack");
      if (res.dispatch.discordSent) parts.push("Discord");
      if (parts.length > 0) {
        setActionNotice(`Delivered alert + reply draft to ${parts.join(" & ")}.`);
      } else {
        setActionError(res.dispatch.errors.join("; ") || "Webhook delivery did not succeed.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Webhook delivery failed");
    } finally {
      setSendingSlack(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!draftEdit) return;
    try {
      await navigator.clipboard.writeText(draftEdit);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Scan CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Buying-Intent Inbox</h1>
          <p className="text-xs text-slate-400">
            Two-stage LLM filtering across Reddit, Hacker News, X &amp; LinkedIn &mdash; plus ready-to-edit reply outlines.
          </p>
        </div>
        <button
          type="button"
          disabled={scanning}
          onClick={handleRunScan}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Run Live Scan Now
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">High-Intent Leads</p>
          <p className="mt-1.5 text-2xl font-bold text-white">{stats.totalLeads}</p>
          <p className="mt-0.5 text-[11px] text-emerald-400">{stats.newLeads} awaiting reply</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Noise Blocked</p>
          <p className="mt-1.5 text-2xl font-bold text-cyan-300">{stats.noiseBlocked}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">kept out of Slack</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Avg Confidence</p>
          <p className="mt-1.5 text-2xl font-bold text-white">{stats.avgConfidence}/100</p>
          <p className="mt-0.5 text-[11px] text-slate-400">LLM intent score</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Replied / Sent</p>
          <p className="mt-1.5 text-2xl font-bold text-white">{stats.repliedLeads}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{stats.alertsSent} alerts dispatched</p>
        </div>
      </div>

      {/* Latest Scan Banner */}
      {scanMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 space-y-2">
          <p className="font-semibold">{scanMessage}</p>
          {lastRun?.channelStatuses ? (
            <div className="flex flex-wrap gap-2">
              {Object.values(lastRun.channelStatuses).map((cs) => (
                <span
                  key={cs.channel}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-300"
                >
                  <strong className="uppercase">{cs.channel}</strong>: {cs.status} ({cs.fetched} fetched)
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab("intent")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              subTab === "intent" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            High-Intent Leads ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("noise")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              subTab === "noise" ? "bg-slate-800 text-slate-200" : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldBan className="h-3.5 w-3.5" />
            Noise Blocked Audit ({noise.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as Channel | "all")}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="all">All Channels</option>
            <option value="reddit">Reddit</option>
            <option value="hackernews">Hacker News</option>
            <option value="x">X (Twitter)</option>
            <option value="linkedin">LinkedIn</option>
          </select>

          {subTab === "intent" ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="replied">Replied</option>
              <option value="dismissed">Dismissed</option>
            </select>
          ) : null}
        </div>
      </div>

      {/* Master-detail split */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left list */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {filteredLeads.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-400 space-y-2">
              <p className="font-semibold text-slate-300">No items match this filter yet.</p>
              <p>Click &ldquo;Run Live Scan Now&rdquo; above to crawl live Reddit &amp; HN threads.</p>
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const selected = selectedLead?.id === lead.id;
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left rounded-xl border p-4 transition space-y-2 cursor-pointer ${
                    selected
                      ? "border-emerald-500/60 bg-slate-900 shadow-md"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <ChannelBadge channel={lead.channel} />
                      <IntentBadge intent={lead.intentType} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {lead.confidenceScore}/100
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-white line-clamp-2">
                    {lead.title || lead.body.slice(0, 95)}
                  </p>
                  <p className="text-xs text-slate-400 line-clamp-2">{lead.body}</p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                      {lead.community} &bull; {lead.authorHandle}
                    </span>
                    <div className="flex items-center gap-2">
                      {lead.status === "replied" ? (
                        <span className="text-emerald-400 font-medium">Replied</span>
                      ) : lead.status === "dismissed" ? (
                        <span className="text-slate-500">Dismissed</span>
                      ) : null}
                      <span>{formatRelativeTime(lead.publishedAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right drawer */}
        <div className="lg:col-span-7">
          {selectedLead ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ChannelBadge channel={selectedLead.channel} />
                    <IntentBadge intent={selectedLead.intentType} />
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                        URGENCY_META[selectedLead.buyingUrgency].className
                      }`}
                    >
                      {URGENCY_META[selectedLead.buyingUrgency].label}
                    </span>
                    <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400">
                      Source: {selectedLead.sourceMode}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white">
                    {selectedLead.title || `Post from ${selectedLead.authorHandle}`}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Monitor: <span className="text-slate-200">{monitorNameById.get(selectedLead.monitorId) ?? "Active Monitor"}</span>{" "}
                    &bull; {selectedLead.community} &bull; {selectedLead.authorHandle} &bull;{" "}
                    {formatRelativeTime(selectedLead.publishedAt)}
                  </p>
                </div>

                <a
                  href={selectedLead.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
                >
                  Open Original
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-xs leading-relaxed text-slate-200 whitespace-pre-line">
                {selectedLead.body}
              </div>

              {/* LLM reasoning + pain points */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5 space-y-2 text-xs">
                <p className="font-semibold text-emerald-300">
                  {selectedLead.isFilteredNoise ? "Why SignalScout Blocked This From Slack" : "Why This Passed LLM Intent Filter"}
                </p>
                <p className="text-slate-300">{selectedLead.reasoning}</p>
                {selectedLead.painPoints.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedLead.painPoints.map((pp) => (
                      <span
                        key={pp}
                        className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                      >
                        {pp}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Contextual Reply Assistant */}
              {!selectedLead.isFilteredNoise ? (
                <div className="space-y-3 border-t border-slate-800 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">Contextual Reply Assistant</h3>
                      <p className="text-[11px] text-slate-400">
                        Structured as: Hook + Helpful peer guidance + Non-salesy soft mention
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(["founder", "peer", "technical"] as ReplyTone[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={regenerating}
                          onClick={() => void handleRegenerate(t)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold capitalize transition cursor-pointer ${
                            regenTone === t
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                              : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={7}
                    value={draftEdit}
                    onChange={(e) => setDraftEdit(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />

                  {actionNotice ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      {actionNotice}
                    </div>
                  ) : null}
                  {actionError ? (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                      {actionError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDraft}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied to Clipboard" : "Copy Reply"}
                    </button>

                    <button
                      type="button"
                      disabled={savingDraft || draftEdit === selectedLead.replyDraft}
                      onClick={() => void handleSaveDraft()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-2 text-xs font-semibold text-white transition cursor-pointer"
                    >
                      {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Save Edits
                    </button>

                    <button
                      type="button"
                      disabled={sendingSlack}
                      onClick={() => void handleSendSlack()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
                    >
                      {sendingSlack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send to Slack/Discord
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleStatusChange(selectedLead.id, "replied")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300 transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Replied
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleStatusChange(selectedLead.id, "dismissed")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-500">
              Select a post to inspect LLM intent details and reply draft.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

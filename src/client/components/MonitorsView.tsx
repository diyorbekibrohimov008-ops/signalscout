import React, { useState } from "react";
import { Loader2, Pause, Play, Plus, Radar, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../api";
import type { Channel, MonitorRecord, ScanRunRecord } from "../types";
import { CHANNEL_META, ChannelBadge, formatRelativeTime } from "./badges";

interface MonitorsViewProps {
  monitors: MonitorRecord[];
  scanRuns: ScanRunRecord[];
  onRefresh: () => Promise<void>;
}

const ALL_CHANNELS: Channel[] = ["reddit", "hackernews", "x", "linkedin"];

export function MonitorsView({ monitors, scanRuns, onRefresh }: MonitorsViewProps) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("social listening, reddit monitoring, buying intent");
  const [competitors, setCompetitors] = useState("syften, octolens");
  const [negativeKeywords, setNegativeKeywords] = useState("giveaway, hiring, top 10");
  const [channels, setChannels] = useState<Channel[]>([...ALL_CHANNELS]);
  const [minConfidence, setMinConfidence] = useState(70);

  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleChannel = (ch: Channel) => {
    setChannels((prev) =>
      prev.includes(ch) ? (prev.length > 1 ? prev.filter((item) => item !== ch) : prev) : [...prev, ch],
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setCreating(true);
    try {
      await api.createMonitor({
        name,
        keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        competitors: competitors.split(",").map((s) => s.trim()).filter(Boolean),
        negativeKeywords: negativeKeywords.split(",").map((s) => s.trim()).filter(Boolean),
        channels,
        minConfidence,
      });
      setName("");
      await onRefresh();
      setMessage("Created monitor across selected channels ($0 add-on fee).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create monitor");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (mon: MonitorRecord) => {
    setBusyId(mon.id);
    setError(null);
    try {
      await api.updateMonitor(mon.id, { isActive: !mon.isActive });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update monitor");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (mon: MonitorRecord) => {
    setBusyId(mon.id);
    setError(null);
    try {
      await api.deleteMonitor(mon.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete monitor");
    } finally {
      setBusyId(null);
    }
  };

  const handleScanMonitor = async (monId: string) => {
    setBusyId(monId);
    setError(null);
    setMessage(null);
    try {
      const res = await api.runScan({ monitorId: monId, includeSimulation: true });
      await onRefresh();
      const run = res.runs[0];
      if (run) {
        setMessage(
          `Scanned monitor: ${run.postsFetched} fetched, ${run.highIntentMatched} high-intent matched, ${run.stage1Dropped + run.llmFilteredNoise} noise blocked.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Monitor scan failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Channel Monitors</h1>
        <p className="text-xs text-slate-400">
          Every monitor includes Reddit, Hacker News, X (Twitter), and LinkedIn with zero per-channel add-on fees.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* New Monitor Form */}
        <form
          onSubmit={handleCreate}
          className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 h-fit"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Plus className="h-4 w-4 text-emerald-400" />
            New All-Channel Monitor
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Monitor Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Syften & Octolens Switchers"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              High-Intent Keywords (comma separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Competitors to Track (comma separated)
            </label>
            <input
              type="text"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Stage-1 Negative Keywords (instant noise drop)
            </label>
            <input
              type="text"
              value={negativeKeywords}
              onChange={(e) => setNegativeKeywords(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Channels Included ($0 add-ons)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CHANNELS.map((ch) => {
                const active = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium text-left transition cursor-pointer ${
                      active
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-800 bg-slate-950 text-slate-400"
                    }`}
                  >
                    {CHANNEL_META[ch].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Minimum LLM Confidence</span>
              <span className="font-bold text-emerald-400">{minConfidence}/100</span>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            Create Monitor
          </button>
        </form>

        {/* Active Monitors List + Recent Scan Runs */}
        <div className="lg:col-span-7 space-y-4">
          {monitors.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
              No monitors created yet. Add your first monitor on the left.
            </div>
          ) : (
            monitors.map((mon) => (
              <div
                key={mon.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{mon.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          mon.isActive
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {mon.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Min confidence: {mon.minConfidence}/100 &bull; Last scanned:{" "}
                      {mon.lastScannedAt ? formatRelativeTime(mon.lastScannedAt) : "Not scanned yet"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyId === mon.id}
                      onClick={() => void handleScanMonitor(mon.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 transition cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Scan
                    </button>
                    <button
                      type="button"
                      disabled={busyId === mon.id}
                      onClick={() => void handleToggleActive(mon)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition cursor-pointer"
                    >
                      {mon.isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {mon.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === mon.id}
                      onClick={() => void handleDelete(mon)}
                      title="Delete monitor"
                      className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-950 hover:bg-rose-950/60 hover:text-rose-300 p-1.5 text-slate-400 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {mon.channels.map((ch) => (
                    <ChannelBadge key={ch} channel={ch} />
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-3 text-[11px] rounded-lg bg-slate-950/60 border border-slate-800/70 p-3">
                  <div>
                    <span className="text-slate-500 block">Keywords</span>
                    <span className="text-slate-200">{mon.keywords.join(", ") || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Competitors</span>
                    <span className="text-slate-200">{mon.competitors.join(", ") || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Negative Blocklist</span>
                    <span className="text-slate-300">{mon.negativeKeywords.join(", ") || "—"}</span>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Scan History */}
          {scanRuns.length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Crawl &amp; Cron Runs
              </h3>
              <div className="space-y-2">
                {scanRuns.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                        {run.triggerType}
                      </span>
                      <span className="text-slate-300">
                        {run.postsFetched} fetched &bull;{" "}
                        <strong className="text-emerald-400">{run.highIntentMatched} intent</strong> &bull;{" "}
                        {run.stage1Dropped + run.llmFilteredNoise} blocked
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">{formatRelativeTime(run.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { ChevronDown, Loader2, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../api";
import type { Channel, MonitorRecord, ScanRunRecord } from "../types";
import { CHANNEL_META, ChannelTag, formatRelativeTime } from "./badges";

interface TopicsViewProps {
  monitors: MonitorRecord[];
  scanRuns: ScanRunRecord[];
  onRefresh: () => Promise<void>;
}

const ALL_CHANNELS: Channel[] = ["reddit", "hackernews", "x", "linkedin"];

export function TopicsView({ monitors, scanRuns, onRefresh }: TopicsViewProps) {
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
        keywords: keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        competitors: competitors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        negativeKeywords: negativeKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        channels,
        minConfidence,
      });
      setName("");
      await onRefresh();
      setMessage("Topic added. Click Scan to pull matching conversations right away.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add topic.");
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
      setError(err instanceof Error ? err.message : "Could not update topic.");
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
      setError(err instanceof Error ? err.message : "Could not delete topic.");
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
          `Scanned topic: checked ${run.postsFetched} posts, found ${run.highIntentMatched} leads, filtered out ${run.stage1Dropped + run.llmFilteredNoise} noisy posts.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8 sm:px-6 space-y-8">
      <header className="max-w-2xl space-y-1.5">
        <h1 className="font-serif text-2xl font-semibold text-[#161B26]">Topics to watch</h1>
        <p className="text-sm text-[#525D70] leading-relaxed">
          Tell SignalScout what words and competitor names to listen for. All four channels — Reddit, Hacker News, X, and
          LinkedIn — are included free.
        </p>
      </header>

      {message ? (
        <div className="rounded-md border border-[#BDE0CE] bg-[#F1F9F5] px-4 py-3 text-[13.5px] text-[#1B6E4F]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-[13.5px] text-[#9B1C1C]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left: Add a Topic Form */}
        <form
          onSubmit={handleCreate}
          className="lg:col-span-5 rounded-md border border-[#DDE2EB] bg-white p-5 sm:p-6 space-y-4"
        >
          <h2 className="text-[15px] font-semibold text-[#161B26]">Add a topic to watch</h2>

          <div>
            <label htmlFor="topic-name" className="block text-xs font-medium text-[#3B4557] mb-1">
              Topic name
            </label>
            <input
              id="topic-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="People looking for a Syften alternative"
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          <div>
            <label htmlFor="topic-keywords" className="block text-xs font-medium text-[#3B4557] mb-1">
              Words to watch for (comma separated)
            </label>
            <input
              id="topic-keywords"
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          <div>
            <label htmlFor="topic-competitors" className="block text-xs font-medium text-[#3B4557] mb-1">
              Competitors to watch (comma separated)
            </label>
            <input
              id="topic-competitors"
              type="text"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          <div>
            <label htmlFor="topic-ignore" className="block text-xs font-medium text-[#3B4557] mb-1">
              Words to ignore (comma separated)
            </label>
            <input
              id="topic-ignore"
              type="text"
              value={negativeKeywords}
              onChange={(e) => setNegativeKeywords(e.target.value)}
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-[#3B4557] mb-2">Where to listen</legend>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CHANNELS.map((ch) => {
                const active = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleChannel(ch)}
                    className={`rounded-md border px-3 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      active
                        ? "border-[#2553B8] bg-[#EBF1FC] text-[#1D4499]"
                        : "border-[#DDE2EB] bg-[#F8F9FB] text-[#525D70] hover:text-[#161B26]"
                    }`}
                  >
                    {CHANNEL_META[ch].label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <details className="border-t border-[#EFF2F6] pt-3 group">
            <summary className="flex items-center justify-between text-xs font-medium text-[#525D70] hover:text-[#161B26] cursor-pointer list-none">
              <span>Advanced filter strictness</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#525D70]">Minimum match score</span>
                <span className="tabular-nums font-semibold text-[#161B26]">{minConfidence} / 100</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full accent-[#2553B8]"
              />
              <p className="text-[11.5px] text-[#525D70]">
                Higher scores filter out more borderline posts. 70 works well for most topics.
              </p>
            </div>
          </details>

          <button
            type="submit"
            disabled={creating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2553B8] hover:bg-[#1D4499] disabled:opacity-60 px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add topic
          </button>
        </form>

        {/* Right: Existing Topics + Scan History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-md border border-[#DDE2EB] bg-white divide-y divide-[#DDE2EB]">
            {monitors.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-[#161B26]">No topics added yet</p>
                <p className="text-xs text-[#525D70]">
                  Add your first topic on the left so SignalScout knows which conversations to watch for you.
                </p>
              </div>
            ) : (
              monitors.map((mon) => (
                <div key={mon.id} className="p-5 space-y-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-[15px] font-semibold text-[#161B26]">{mon.name}</h3>
                        <span
                          className={`text-xs font-medium ${
                            mon.isActive ? "text-[#1B6E4F]" : "text-[#525D70]"
                          }`}
                        >
                          {mon.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#525D70] tabular-nums">
                        Minimum score {mon.minConfidence}/100
                        <span className="mx-2 text-[#C5CEDB]" aria-hidden="true">|</span>
                        Last scanned {mon.lastScannedAt ? formatRelativeTime(mon.lastScannedAt) : "not yet"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === mon.id}
                        onClick={() => void handleScanMonitor(mon.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#EBF1FC] hover:text-[#2553B8] px-2.5 py-1.5 text-xs font-medium text-[#161B26] cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Scan
                      </button>
                      <button
                        type="button"
                        disabled={busyId === mon.id}
                        onClick={() => void handleToggleActive(mon)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-2.5 py-1.5 text-xs font-medium text-[#3B4557] cursor-pointer"
                      >
                        {mon.isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {mon.isActive ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === mon.id}
                        onClick={() => void handleDelete(mon)}
                        aria-label={`Delete ${mon.name}`}
                        title="Delete topic"
                        className="inline-flex items-center rounded-md border border-[#DDE2EB] bg-white hover:bg-[#FDF2F2] hover:text-[#9B1C1C] p-1.5 text-[#525D70] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {mon.channels.map((ch) => (
                      <ChannelTag key={ch} channel={ch} />
                    ))}
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-3 text-xs pt-2 border-t border-[#EFF2F6]">
                    <div>
                      <dt className="text-[#525D70] mb-0.5">Watching</dt>
                      <dd className="text-[#161B26]">{mon.keywords.join(", ") || "None"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#525D70] mb-0.5">Competitors</dt>
                      <dd className="text-[#161B26]">{mon.competitors.join(", ") || "None"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#525D70] mb-0.5">Ignoring</dt>
                      <dd className="text-[#3B4557]">{mon.negativeKeywords.join(", ") || "None"}</dd>
                    </div>
                  </dl>
                </div>
              ))
            )}
          </div>

          {scanRuns.length > 0 ? (
            <section className="rounded-md border border-[#DDE2EB] bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#161B26]">Recent scans</h2>
              <div className="divide-y divide-[#EFF2F6] text-xs">
                {scanRuns.slice(0, 6).map((run) => (
                  <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#3B4557] tabular-nums">
                      <span className="capitalize font-medium text-[#161B26]">{run.triggerType}</span>
                      <span>{run.postsFetched} checked</span>
                      <span className="text-[#1B6E4F] font-medium">{run.highIntentMatched} leads</span>
                      <span className="text-[#525D70]">
                        {run.stage1Dropped + run.llmFilteredNoise} filtered out
                      </span>
                    </div>
                    <span className="text-[#525D70] tabular-nums">{formatRelativeTime(run.createdAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

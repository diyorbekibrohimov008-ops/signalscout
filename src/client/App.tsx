import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "./api";
import { AuthModal } from "./components/AuthModal";
import { LeadsReaderView } from "./components/LeadsReaderView";
import { NotificationsView } from "./components/NotificationsView";
import { SettingsView } from "./components/SettingsView";
import { TopBar, type ReaderTab } from "./components/TopBar";
import { TopicsView } from "./components/TopicsView";
import type {
  LeadRecord,
  MonitorRecord,
  PublicUser,
  SanitizedWorkspace,
  ScanRunRecord,
  WorkspaceStats,
} from "./types";

const DEMO_EMAIL = "demo@signalscout.app";

export function App() {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [signedOutExplicitly, setSignedOutExplicitly] = useState(false);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [workspace, setWorkspace] = useState<SanitizedWorkspace | null>(null);
  const [stats, setStats] = useState<WorkspaceStats>({
    totalLeads: 0,
    newLeads: 0,
    repliedLeads: 0,
    noiseBlocked: 0,
    alertsSent: 0,
    activeMonitors: 0,
    avgConfidence: 0,
  });
  const [monitors, setMonitors] = useState<MonitorRecord[]>([]);
  const [scanRuns, setScanRuns] = useState<ScanRunRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [noise, setNoise] = useState<LeadRecord[]>([]);

  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [activeTab, setActiveTab] = useState<ReaderTab>("leads");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async () => {
    const [me, feed] = await Promise.all([api.getMe(), api.listLeads({ filter: "all" })]);
    setUser(me.user);
    setWorkspace(me.workspace);
    setStats(feed.stats);
    setMonitors(me.monitors);
    setScanRuns(me.scanRuns);
    setLeads(feed.leads);
    setNoise(feed.noise);
  }, []);

  const hydrateSession = useCallback(async () => {
    setBootError(null);
    try {
      await loadWorkspaceData();
      setSignedOutExplicitly(false);
    } catch {
      // Automatically open the free pre-loaded reader on first visit so beginners
      // see real leads, margin notes, and reply drafts immediately without a login wall.
      try {
        await api.launchDemo();
        await loadWorkspaceData();
        setSignedOutExplicitly(false);
      } catch (err) {
        setUser(null);
        setWorkspace(null);
        setBootError(err instanceof Error ? err.message : "Could not connect to SignalScout.");
      }
    } finally {
      setBooting(false);
    }
  }, [loadWorkspaceData]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const handleScanNow = async () => {
    setScanning(true);
    setScanMessage(null);
    setScanError(null);
    try {
      const res = await api.runScan({ includeSimulation: true });
      await loadWorkspaceData();
      const totalMatched = res.runs.reduce((acc, r) => acc + r.highIntentMatched, 0);
      const totalFetched = res.runs.reduce((acc, r) => acc + r.postsFetched, 0);
      const totalBlocked = res.runs.reduce((acc, r) => acc + r.stage1Dropped + r.llmFilteredNoise, 0);
      setScanMessage(
        `Scan finished: checked ${totalFetched} posts, filtered out ${totalBlocked} noisy posts, found ${totalMatched} new lead${totalMatched === 1 ? "" : "s"}.`,
      );
      setActiveTab("leads");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setWorkspace(null);
      setLeads([]);
      setNoise([]);
      setMonitors([]);
      setScanRuns([]);
      setSignedOutExplicitly(true);
      setActiveTab("leads");
    }
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB] text-[#525D70] text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#2553B8]" />
        Opening SignalScout…
      </div>
    );
  }

  if (!user || !workspace) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-[#DDE2EB] bg-white p-7 space-y-5">
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-semibold text-[#161B26]">SignalScout</h1>
            <p className="text-sm text-[#3B4557] leading-relaxed">
              Find people asking for a tool like yours on Reddit, X, LinkedIn and Hacker News — free.
            </p>
          </div>

          {bootError ? (
            <div className="rounded-md border border-[#F2C6C6] bg-[#FDF2F2] px-3.5 py-2.5 text-xs text-[#9B1C1C]">
              {bootError}
            </div>
          ) : null}

          {signedOutExplicitly ? (
            <p className="text-xs text-[#525D70]">You have signed out of your workspace.</p>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void hydrateSession()}
              className="w-full rounded-md bg-[#2553B8] hover:bg-[#1D4499] px-4 py-2.5 text-sm font-medium text-white cursor-pointer"
            >
              Open free reader
            </button>
            <button
              type="button"
              onClick={() => setAuthModal("login")}
              className="w-full rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-4 py-2 text-sm font-medium text-[#161B26] cursor-pointer"
            >
              Sign in to your account
            </button>
          </div>
        </div>

        {authModal ? (
          <AuthModal
            initialMode={authModal}
            onClose={() => setAuthModal(null)}
            onAuthenticated={loadWorkspaceData}
          />
        ) : null}
      </div>
    );
  }

  const isDemoAccount = user.email.toLowerCase() === DEMO_EMAIL;

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#161B26]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        isDemoAccount={isDemoAccount}
        stats={stats}
        scanning={scanning}
        onScanNow={() => void handleScanNow()}
        onOpenAuth={(mode) => setAuthModal(mode)}
        onLogout={() => void handleLogout()}
      />

      <main>
        {activeTab === "leads" ? (
          <LeadsReaderView
            leads={leads}
            noise={noise}
            stats={stats}
            monitors={monitors}
            scanRuns={scanRuns}
            scanMessage={scanMessage}
            scanError={scanError}
            onScanNow={() => void handleScanNow()}
            scanning={scanning}
            onRefresh={loadWorkspaceData}
            onGoToNotifications={() => setActiveTab("notifications")}
          />
        ) : null}

        {activeTab === "topics" ? (
          <TopicsView monitors={monitors} scanRuns={scanRuns} onRefresh={loadWorkspaceData} />
        ) : null}

        {activeTab === "notifications" ? (
          <NotificationsView
            workspace={workspace}
            sampleLead={leads[0] ?? null}
            onRefresh={loadWorkspaceData}
          />
        ) : null}

        {activeTab === "settings" ? (
          <SettingsView
            user={user}
            workspace={workspace}
            isDemoAccount={isDemoAccount}
            onRefresh={loadWorkspaceData}
            onOpenAuth={(mode) => setAuthModal(mode)}
          />
        ) : null}
      </main>

      {authModal ? (
        <AuthModal
          initialMode={authModal}
          onClose={() => setAuthModal(null)}
          onAuthenticated={async () => {
            await loadWorkspaceData();
            setSignedOutExplicitly(false);
          }}
        />
      ) : null}
    </div>
  );
}

export default App;

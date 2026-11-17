import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "./api";
import { AuthModal } from "./components/AuthModal";
import { BillingView } from "./components/BillingView";
import { InboxView } from "./components/InboxView";
import { IntegrationsView } from "./components/IntegrationsView";
import { LandingView } from "./components/LandingView";
import { MonitorsView } from "./components/MonitorsView";
import { Sidebar, type DashboardTab } from "./components/Sidebar";
import type {
  LeadRecord,
  MonitorRecord,
  PublicUser,
  SanitizedWorkspace,
  ScanRunRecord,
  WorkspaceStats,
} from "./types";

export function App() {
  const [booting, setBooting] = useState(true);
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
  const [activeTab, setActiveTab] = useState<DashboardTab>("inbox");

  const hydrateSession = useCallback(async () => {
    try {
      const me = await api.getMe();
      const feed = await api.listLeads({ filter: "all" });
      setUser(me.user);
      setWorkspace(me.workspace);
      setStats(feed.stats);
      setMonitors(me.monitors);
      setScanRuns(me.scanRuns);
      setLeads(feed.leads);
      setNoise(feed.noise);
    } catch {
      setUser(null);
      setWorkspace(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

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
      setActiveTab("inbox");
    }
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 text-sm">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-400" />
        Loading SignalScout…
      </div>
    );
  }

  if (!user || !workspace) {
    return (
      <>
        <LandingView
          onOpenAuth={(mode) => setAuthModal(mode)}
          onAuthenticated={hydrateSession}
        />
        {authModal ? (
          <AuthModal
            initialMode={authModal}
            onClose={() => setAuthModal(null)}
            onAuthenticated={hydrateSession}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        workspace={workspace}
        stats={stats}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl">
        {activeTab === "inbox" ? (
          <InboxView
            leads={leads}
            noise={noise}
            stats={stats}
            monitors={monitors}
            scanRuns={scanRuns}
            onRefresh={hydrateSession}
          />
        ) : null}

        {activeTab === "monitors" ? (
          <MonitorsView
            monitors={monitors}
            scanRuns={scanRuns}
            onRefresh={hydrateSession}
          />
        ) : null}

        {activeTab === "integrations" ? (
          <IntegrationsView
            workspace={workspace}
            onRefresh={hydrateSession}
          />
        ) : null}

        {activeTab === "billing" ? (
          <BillingView onRefresh={hydrateSession} />
        ) : null}
      </main>
    </div>
  );
}
export default App;

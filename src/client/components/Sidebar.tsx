import React from "react";
import {
  CreditCard,
  Inbox,
  LogOut,
  Plug,
  Radar,
  Radio,
} from "lucide-react";
import type { PublicUser, SanitizedWorkspace, WorkspaceStats } from "../types";

export type DashboardTab = "inbox" | "monitors" | "integrations" | "billing";

interface SidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  user: PublicUser;
  workspace: SanitizedWorkspace;
  stats: WorkspaceStats;
  onLogout: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  user,
  workspace,
  stats,
  onLogout,
}: SidebarProps) {
  const navItems: Array<{
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }> = [
    { id: "inbox", label: "Intent Inbox", icon: Inbox, badge: stats.newLeads > 0 ? stats.newLeads : undefined },
    { id: "monitors", label: "Channel Monitors", icon: Radar, badge: stats.activeMonitors },
    { id: "integrations", label: "Slack & Bridges", icon: Plug },
    {
      id: "billing",
      label: "$25 Flat Plan",
      icon: CreditCard,
      badge: workspace.plan === "pro_flat_25" ? "Active" : workspace.plan === "trial" ? "Trial" : "Paused",
    },
  ];

  return (
    <aside className="flex w-full flex-col justify-between border-b border-slate-800 bg-slate-900/90 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Radio className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">SignalScout</p>
              <p className="text-[11px] text-slate-400 truncate">{workspace.name}</p>
            </div>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      active ? "bg-emerald-500/25 text-emerald-200" : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>All 4 Channels</span>
            <span className="font-semibold text-emerald-400">$0 Add-Ons</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Reddit &amp; HN poll live every 10 minutes. X &amp; LinkedIn accept live API tokens or Zapier/Apify
            webhook pushes at no extra tier fee.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-800 p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
          <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="lg:hidden">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

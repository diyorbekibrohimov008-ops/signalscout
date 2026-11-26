import React from "react";
import { Loader2, LogOut, RefreshCw, User } from "lucide-react";
import type { PublicUser, WorkspaceStats } from "../types";

export type ReaderTab = "leads" | "topics" | "notifications" | "settings";

interface TopBarProps {
  activeTab: ReaderTab;
  onSelectTab: (tab: ReaderTab) => void;
  user: PublicUser;
  isDemoAccount: boolean;
  stats: WorkspaceStats;
  scanning: boolean;
  onScanNow: () => void;
  onOpenAuth: (mode: "login" | "register") => void;
  onLogout: () => void;
}

export function TopBar({
  activeTab,
  onSelectTab,
  user,
  isDemoAccount,
  stats,
  scanning,
  onScanNow,
  onOpenAuth,
  onLogout,
}: TopBarProps) {
  const navItems: Array<{ id: ReaderTab; label: string; count?: number }> = [
    { id: "leads", label: "Leads", count: stats.newLeads > 0 ? stats.newLeads : undefined },
    { id: "topics", label: "Topics to watch", count: stats.activeMonitors > 0 ? stats.activeMonitors : undefined },
    { id: "notifications", label: "Notifications" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <header className="border-b border-[#DDE2EB] bg-white">
      {/* Row 1: Brand, Navigation (desktop), Primary Action & Account */}
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 h-14">
        <div className="flex items-center gap-7 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab("leads")}
            className="flex items-center gap-2.5 text-left shrink-0 cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
              <rect width="32" height="32" rx="7" fill="#F8F9FB" stroke="#DDE2EB" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="8.5" fill="none" stroke="#2553B8" strokeWidth="2.2" />
              <circle cx="16" cy="16" r="3" fill="#2553B8" />
            </svg>
            <span className="font-serif text-[17px] font-semibold tracking-tight text-[#161B26]">
              SignalScout
            </span>
          </button>

          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 h-14">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2 h-full px-3 text-[13.5px] font-medium transition-colors cursor-pointer ${
                    active ? "text-[#161B26]" : "text-[#525D70] hover:text-[#161B26]"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.count !== undefined ? (
                    <span
                      className={`tabular-nums text-[11.5px] px-1.5 py-0.5 rounded-sm ${
                        active
                          ? "bg-[#EBF1FC] text-[#2553B8] font-semibold"
                          : "bg-[#EFF2F6] text-[#525D70]"
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                  {active ? (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#2553B8]" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            disabled={scanning}
            onClick={onScanNow}
            className="inline-flex items-center gap-2 rounded-md bg-[#2553B8] hover:bg-[#1D4499] disabled:opacity-60 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors cursor-pointer"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Scan for new posts</span>
            <span className="sm:hidden">Scan</span>
          </button>

          {isDemoAccount ? (
            <button
              type="button"
              onClick={() => onOpenAuth("register")}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-3 py-1.5 text-[13px] font-medium text-[#161B26] transition-colors cursor-pointer"
            >
              <User className="h-3.5 w-3.5 text-[#525D70]" />
              <span>Sign in</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline text-xs text-[#525D70] max-w-[140px] truncate">
                {user.name}
              </span>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-2.5 py-1.5 text-xs font-medium text-[#525D70] hover:text-[#161B26] transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile navigation row */}
      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden items-center justify-between border-t border-[#EFF2F6] px-2"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-1 whitespace-nowrap px-2 py-2.5 text-[12.5px] font-medium cursor-pointer ${
                active ? "text-[#2553B8]" : "text-[#525D70]"
              }`}
            >
              <span>{item.label}</span>
              {active ? (
                <span className="absolute inset-x-1.5 bottom-0 h-[2px] bg-[#2553B8]" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Beginner orientation strip */}
      <div className="border-t border-[#EFF2F6] bg-[#F8F9FB]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <p className="text-[13px] text-[#3B4557]">
            Find people asking for a tool like yours on Reddit, X, LinkedIn and Hacker News — free.
          </p>
          <p className="hidden sm:block text-xs text-[#525D70] tabular-nums">
            {stats.totalLeads} leads found
            <span className="mx-2 text-[#C5CEDB]" aria-hidden="true">|</span>
            {stats.noiseBlocked} noisy posts filtered out
          </p>
        </div>
      </div>
    </header>
  );
}

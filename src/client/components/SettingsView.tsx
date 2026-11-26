import React, { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "../api";
import type { PublicUser, ReplyTone, SanitizedWorkspace } from "../types";

interface SettingsViewProps {
  user: PublicUser;
  workspace: SanitizedWorkspace;
  isDemoAccount: boolean;
  onRefresh: () => Promise<void>;
  onOpenAuth: (mode: "login" | "register") => void;
}

export function SettingsView({
  user,
  workspace,
  isDemoAccount,
  onRefresh,
  onOpenAuth,
}: SettingsViewProps) {
  const [productName, setProductName] = useState(workspace.productName);
  const [productUrl, setProductUrl] = useState(workspace.productUrl);
  const [productDescription, setProductDescription] = useState(workspace.productDescription);
  const [idealCustomer, setIdealCustomer] = useState(workspace.idealCustomer);
  const [defaultTone, setDefaultTone] = useState<ReplyTone>(workspace.defaultTone);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Accurate Syften vs SignalScout ($0) channel savings comparison
  const [calcRedditHn, setCalcRedditHn] = useState(true);
  const [calcX, setCalcX] = useState(true);
  const [calcLinkedIn, setCalcLinkedIn] = useState(true);
  const [calcYouTube, setCalcYouTube] = useState(false);

  useEffect(() => {
    setProductName(workspace.productName);
    setProductUrl(workspace.productUrl);
    setProductDescription(workspace.productDescription);
    setIdealCustomer(workspace.idealCustomer);
    setDefaultTone(workspace.defaultTone);
  }, [
    workspace.id,
    workspace.productName,
    workspace.productUrl,
    workspace.productDescription,
    workspace.idealCustomer,
    workspace.defaultTone,
  ]);

  const syftenMonthly = (calcRedditHn ? 29.95 : 0) + (calcX ? 40 : 0) + (calcYouTube ? 20 : 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await api.updateSettings({
        productName,
        productUrl,
        productDescription,
        idealCustomer,
        defaultTone,
      });
      await onRefresh();
      setNotice("Saved product details. New reply drafts will use this context.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 space-y-10">
      <header className="max-w-2xl space-y-1.5">
        <h1 className="font-serif text-2xl font-semibold text-[#161B26]">Settings</h1>
        <p className="text-sm text-[#525D70] leading-relaxed">
          Describe your product so SignalScout writes accurate, natural reply drafts for you.
        </p>
      </header>

      {notice ? (
        <div className="rounded-md border border-[#BDE0CE] bg-[#F1F9F5] px-4 py-3 text-[13.5px] text-[#1B6E4F]">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-[13.5px] text-[#9B1C1C]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Product details form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 rounded-md border border-[#DDE2EB] bg-white p-5 sm:p-6 space-y-4"
        >
          <h2 className="text-[15px] font-semibold text-[#161B26]">About your product</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="set-product-name" className="block text-xs font-medium text-[#3B4557] mb-1">
                Product name
              </label>
              <input
                id="set-product-name"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="AcmeNotes"
                className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
              />
            </div>
            <div>
              <label htmlFor="set-product-url" className="block text-xs font-medium text-[#3B4557] mb-1">
                Website URL
              </label>
              <input
                id="set-product-url"
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="set-product-desc" className="block text-xs font-medium text-[#3B4557] mb-1">
              One-sentence summary
            </label>
            <textarea
              id="set-product-desc"
              rows={3}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm leading-relaxed text-[#161B26]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="set-ideal-customer" className="block text-xs font-medium text-[#3B4557] mb-1">
                Who you help
              </label>
              <input
                id="set-ideal-customer"
                type="text"
                value={idealCustomer}
                onChange={(e) => setIdealCustomer(e.target.value)}
                placeholder="Small SaaS founders"
                className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
              />
            </div>
            <div>
              <label htmlFor="set-default-tone" className="block text-xs font-medium text-[#3B4557] mb-1">
                Default reply tone
              </label>
              <select
                id="set-default-tone"
                value={defaultTone}
                onChange={(e) => setDefaultTone(e.target.value as ReplyTone)}
                className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
              >
                <option value="founder">Founder (direct and transparent)</option>
                <option value="peer">Peer (casual builder voice)</option>
                <option value="technical">Technical (architecture focused)</option>
              </select>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-[#2553B8] hover:bg-[#1D4499] disabled:opacity-60 px-4 py-2 text-sm font-medium text-white cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save settings
            </button>
          </div>
        </form>

        {/* Right: Account & Free plan status */}
        <div className="lg:col-span-5 space-y-5">
          <section className="rounded-md border border-[#DDE2EB] bg-white p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-[#161B26]">Account</h2>
              <span className="text-xs font-medium text-[#1B6E4F]">100% Free</span>
            </div>
            <p className="text-xs text-[#525D70] leading-relaxed">
              {isDemoAccount
                ? "You are exploring the open demo workspace. Create a free account anytime to keep your own topics and Slack notifications private."
                : `Signed in as ${user.name} (${user.email}). Every channel, filter, and reply draft is unlocked with no fees or usage caps.`}
            </p>
            {isDemoAccount ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAuth("register")}
                  className="rounded-md bg-[#2553B8] hover:bg-[#1D4499] px-3.5 py-2 text-xs font-medium text-white cursor-pointer"
                >
                  Create free account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth("login")}
                  className="rounded-md border border-[#DDE2EB] bg-white hover:bg-[#F8F9FB] px-3.5 py-2 text-xs font-medium text-[#161B26] cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-[#DDE2EB] bg-white p-5 space-y-3.5">
            <h2 className="text-[15px] font-semibold text-[#161B26]">Cost vs. Syften add-ons</h2>
            <p className="text-xs text-[#525D70] leading-relaxed">
              Syften starts at $29.95/mo and charges extra per channel ($40/mo for X, $20/mo for YouTube). SignalScout
              is $0 across all four channels.
            </p>
            <div className="space-y-2 text-xs text-[#161B26]">
              {[
                { label: "Reddit & Hacker News ($29.95/mo on Syften)", checked: calcRedditHn, set: setCalcRedditHn },
                { label: "X / Twitter (+$40.00/mo on Syften)", checked: calcX, set: setCalcX },
                { label: "LinkedIn signals ($0 on SignalScout)", checked: calcLinkedIn, set: setCalcLinkedIn },
                { label: "YouTube mentions (+$20.00/mo on Syften)", checked: calcYouTube, set: setCalcYouTube },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.set(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#2553B8]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="border-t border-[#EFF2F6] pt-3 flex items-baseline justify-between text-xs tabular-nums">
              <div>
                <p className="text-[#525D70]">Syften total</p>
                <p className="text-base font-semibold text-[#161B26]">${syftenMonthly.toFixed(2)}/mo</p>
              </div>
              <div className="text-right">
                <p className="text-[#525D70]">SignalScout</p>
                <p className="text-base font-semibold text-[#1B6E4F]">$0.00/mo</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Accurate comparison table */}
      <section className="space-y-3 border-t border-[#DDE2EB] pt-8">
        <h2 className="font-serif text-lg font-semibold text-[#161B26]">
          How SignalScout compares with Syften and Octolens
        </h2>
        <div className="overflow-x-auto rounded-md border border-[#DDE2EB] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#DDE2EB] bg-[#F8F9FB] text-xs font-semibold text-[#3B4557]">
              <tr>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3 text-[#2553B8]">SignalScout</th>
                <th className="px-4 py-3">Syften</th>
                <th className="px-4 py-3">Octolens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF2F6]">
              {[
                {
                  feature: "Monthly price",
                  ss: "$0 (100% free)",
                  syften: "$29.95 base + $40 X + $20 YouTube",
                  octolens: "Paid seat & volume tiers",
                },
                {
                  feature: "Reddit & Hacker News scanning",
                  ss: "Included",
                  syften: "Included",
                  octolens: "Included",
                },
                {
                  feature: "X & LinkedIn coverage",
                  ss: "Included ($0 add-on)",
                  syften: "$40/mo X add-on",
                  octolens: "Plan-gated",
                },
                {
                  feature: "Buying-intent noise filter",
                  ss: "Two-stage filter + Filtered log",
                  syften: "Keyword rules",
                  octolens: "AI relevance scoring",
                },
                {
                  feature: "Ready-to-edit reply drafts",
                  ss: "Included in reader & Slack",
                  syften: "Manual",
                  octolens: "Alert-first",
                },
              ].map((row) => (
                <tr key={row.feature}>
                  <td className="px-4 py-3 font-medium text-[#161B26]">{row.feature}</td>
                  <td className="px-4 py-3 font-medium text-[#1B6E4F]">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      {row.ss}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#525D70]">{row.syften}</td>
                  <td className="px-4 py-3 text-[#525D70]">{row.octolens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

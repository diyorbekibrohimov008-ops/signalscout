import React, { useState } from "react";
import { Loader2, Radio, X } from "lucide-react";
import { api } from "../api";

interface AuthModalProps {
  initialMode: "login" | "register";
  onClose: () => void;
  onAuthenticated: () => Promise<void>;
}

export function AuthModal({ initialMode, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await api.login({ email, password });
      } else {
        await api.register({
          name,
          email,
          password,
          companyName: companyName || undefined,
          productName: productName || undefined,
          productDescription: productDescription || undefined,
        });
      }
      await onAuthenticated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.launchDemo();
      await onAuthenticated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch demo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overscroll-contain">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl overscroll-contain">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {mode === "login" ? "Sign in to SignalScout" : "Create your $25/mo flat workspace"}
            </h2>
            <p className="text-xs text-slate-400">
              Reddit, X, LinkedIn &amp; HN included &bull; 14-day free trial
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded-md py-1.5 transition cursor-pointer ${
              mode === "register" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Create Workspace
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-md py-1.5 transition cursor-pointer ${
              mode === "login" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Product Name</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="AcmeAnalytics"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Inc."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="founder@company.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Password (6+ characters)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                What does your product do? (powers Reply Assistant)
              </label>
              <textarea
                rows={2}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="One sentence describing who you help and what makes you better..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          )}

          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-slate-950 transition cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "login" ? "Sign In" : "Create Free Trial Workspace"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
          <div className="h-px flex-1 bg-slate-800" />
          <span>or explore instantly</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleDemo}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
        >
          Launch Instant Demo Workspace (pre-loaded leads &amp; noise log)
        </button>
      </div>
    </div>
  );
}

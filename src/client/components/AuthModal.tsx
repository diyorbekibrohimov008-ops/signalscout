import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
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
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
          productName: productName || undefined,
          productDescription: productDescription || undefined,
        });
      }
      await onAuthenticated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#161B26]/35 backdrop-blur-[2px] p-4 overscroll-contain"
    >
      <div className="relative w-full max-w-md rounded-lg border border-[#DDE2EB] bg-white p-6 shadow-xl overscroll-contain">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-md p-1.5 text-[#525D70] hover:bg-[#F8F9FB] hover:text-[#161B26] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 space-y-1">
          <h2 id="auth-modal-title" className="font-serif text-xl font-semibold text-[#161B26]">
            {mode === "login" ? "Sign in to SignalScout" : "Create your free workspace"}
          </h2>
          <p className="text-xs text-[#525D70]">
            Keep your topics, reply drafts, and Slack notifications private — free forever.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-md border border-[#DDE2EB] bg-[#F8F9FB] p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded py-1.5 transition-colors cursor-pointer ${
              mode === "register" ? "bg-white text-[#161B26] shadow-2xs" : "text-[#525D70] hover:text-[#161B26]"
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded py-1.5 transition-colors cursor-pointer ${
              mode === "login" ? "bg-white text-[#161B26] shadow-2xs" : "text-[#525D70] hover:text-[#161B26]"
            }`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-[#3B4557] mb-1">
                  Your name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
                />
              </div>
              <div>
                <label htmlFor="auth-product" className="block text-xs font-medium text-[#3B4557] mb-1">
                  Product name
                </label>
                <input
                  id="auth-product"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="AcmeNotes"
                  className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-[#3B4557] mb-1">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-[#3B4557] mb-1">
              Password (at least 6 characters)
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
            />
          </div>

          {mode === "register" ? (
            <div>
              <label htmlFor="auth-desc" className="block text-xs font-medium text-[#3B4557] mb-1">
                What does your product do? (optional)
              </label>
              <textarea
                id="auth-desc"
                rows={2}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="One sentence used to personalize your reply drafts"
                className="w-full rounded-md border border-[#CFD7E3] bg-white px-3 py-2 text-sm text-[#161B26]"
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-[#F2C6C6] bg-[#FDF2F2] px-3 py-2 text-xs text-[#9B1C1C]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2553B8] hover:bg-[#1D4499] disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "login" ? "Sign in" : "Create free workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}

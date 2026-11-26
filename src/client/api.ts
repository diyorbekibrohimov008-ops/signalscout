import type {
  AuthMeResponse,
  Channel,
  DemoEvaluateResponse,
  DispatchResult,
  HealthResponse,
  LeadRecord,
  LeadStatus,
  MonitorRecord,
  PublicUser,
  ReplyTone,
  SanitizedWorkspace,
  ScanRunRecord,
  WorkspaceStats,
} from "./types";

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Unexpected server response (${res.status})`);
    }
  }

  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }

  return data as T;
}

export const api = {
  getHealth(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>("/api/health");
  },

  evaluateDemo(input: {
    channel: Channel;
    title?: string;
    body: string;
    authorHandle?: string;
    keywords?: string[];
    competitors?: string[];
    negativeKeywords?: string[];
    productName?: string;
    productDescription?: string;
    tone?: ReplyTone;
  }): Promise<DemoEvaluateResponse> {
    return apiFetch<DemoEvaluateResponse>("/api/demo/evaluate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  register(input: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
    productName?: string;
    productDescription?: string;
  }): Promise<{ user: PublicUser; workspace: SanitizedWorkspace }> {
    return apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }): Promise<{ user: PublicUser; workspace: SanitizedWorkspace }> {
    return apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  launchDemo(): Promise<{ user: PublicUser; workspace: SanitizedWorkspace }> {
    return apiFetch("/api/auth/demo", { method: "POST" });
  },

  logout(): Promise<{ ok: boolean }> {
    return apiFetch("/api/auth/logout", { method: "POST" });
  },

  getMe(): Promise<AuthMeResponse> {
    return apiFetch<AuthMeResponse>("/api/auth/me");
  },

  createMonitor(input: {
    name: string;
    keywords: string[];
    competitors: string[];
    negativeKeywords: string[];
    channels: Channel[];
    minConfidence: number;
  }): Promise<{ monitor: MonitorRecord }> {
    return apiFetch("/api/monitors", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateMonitor(
    id: string,
    patch: Partial<{
      name: string;
      keywords: string[];
      competitors: string[];
      negativeKeywords: string[];
      channels: Channel[];
      minConfidence: number;
      isActive: boolean;
    }>,
  ): Promise<{ monitor: MonitorRecord }> {
    return apiFetch(`/api/monitors/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteMonitor(id: string): Promise<{ ok: boolean }> {
    return apiFetch(`/api/monitors/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  listLeads(params?: {
    channel?: Channel | "all";
    status?: LeadStatus | "all";
    filter?: "all" | "intent" | "noise";
  }): Promise<{ leads: LeadRecord[]; noise: LeadRecord[]; stats: WorkspaceStats }> {
    const qs = new URLSearchParams();
    if (params?.channel) qs.set("channel", params.channel);
    if (params?.status) qs.set("status", params.status);
    qs.set("filter", params?.filter ?? "all");
    return apiFetch(`/api/leads?${qs.toString()}`);
  },

  updateLead(
    id: string,
    patch: { status?: LeadStatus; replyDraft?: string },
  ): Promise<{ lead: LeadRecord }> {
    return apiFetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  regenerateReply(id: string, tone: ReplyTone): Promise<{ lead: LeadRecord }> {
    return apiFetch(`/api/leads/${encodeURIComponent(id)}/regenerate-reply`, {
      method: "POST",
      body: JSON.stringify({ tone }),
    });
  },

  sendLeadToSlack(id: string): Promise<{ lead: LeadRecord; dispatch: DispatchResult }> {
    return apiFetch(`/api/leads/${encodeURIComponent(id)}/send-slack`, {
      method: "POST",
    });
  },

  runScan(input?: { monitorId?: string; includeSimulation?: boolean }): Promise<{
    ok: boolean;
    runs: ScanRunRecord[];
    stats: WorkspaceStats;
  }> {
    return apiFetch("/api/scan", {
      method: "POST",
      body: JSON.stringify(input ?? { includeSimulation: true }),
    });
  },

  updateSettings(patch: {
    name?: string;
    productName?: string;
    productDescription?: string;
    productUrl?: string;
    idealCustomer?: string;
    defaultTone?: ReplyTone;
    slackWebhookUrl?: string;
    discordWebhookUrl?: string;
    customOpenaiKey?: string;
    xBearerToken?: string;
    apifyToken?: string;
  }): Promise<{ workspace: SanitizedWorkspace }> {
    return apiFetch("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  testWebhook(): Promise<{ ok: boolean; dispatch: DispatchResult }> {
    return apiFetch("/api/settings/test-webhook", {
      method: "POST",
    });
  },

  ingestWebhookSample(
    ingestSecret: string,
    post: {
      channel: Channel;
      author: string;
      authorHandle: string;
      title?: string;
      body: string;
      url?: string;
      community?: string;
    },
  ): Promise<{ ok: boolean; scanRun: ScanRunRecord }> {
    return apiFetch(`/api/ingest/webhook?secret=${encodeURIComponent(ingestSecret)}`, {
      method: "POST",
      body: JSON.stringify({ posts: [post] }),
    });
  },
};

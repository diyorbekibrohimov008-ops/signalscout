export type Channel = "reddit" | "x" | "linkedin" | "hackernews";

export type IntentType =
  | "recommendation_request"
  | "competitor_complaint"
  | "explicit_buying_intent"
  | "noise_or_irrelevant";

export type BuyingUrgency = "high" | "medium" | "low";

export type ReplyTone = "founder" | "peer" | "technical";

export type LeadStatus = "new" | "replied" | "dismissed";

export type PlanTier = "free";

export type SourceMode = "live" | "webhook" | "simulation";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  companyName?: string;
}

export interface SanitizedWorkspace {
  id: string;
  name: string;
  productName: string;
  productDescription: string;
  productUrl: string;
  idealCustomer: string;
  defaultTone: ReplyTone;
  plan: PlanTier;
  slackWebhookUrl: string;
  discordWebhookUrl: string;
  ingestSecret: string;
  customOpenaiKeySet: boolean;
  xBearerTokenSet: boolean;
  apifyTokenSet: boolean;
  createdAt: string;
}

export interface MonitorRecord {
  id: string;
  workspaceId: string;
  name: string;
  keywords: string[];
  competitors: string[];
  negativeKeywords: string[];
  channels: Channel[];
  minConfidence: number;
  isActive: boolean;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface LeadRecord {
  id: string;
  workspaceId: string;
  monitorId: string;
  channel: Channel;
  externalId: string;
  author: string;
  authorHandle: string;
  title: string;
  body: string;
  url: string;
  community: string;
  intentType: IntentType;
  confidenceScore: number;
  buyingUrgency: BuyingUrgency;
  reasoning: string;
  painPoints: string[];
  isFilteredNoise: boolean;
  replyHook: string;
  replyValuePoints: string[];
  replySoftMention: string;
  replyDraft: string;
  replyTone: ReplyTone;
  status: LeadStatus;
  alertSentSlack: boolean;
  alertSentDiscord: boolean;
  sourceMode: SourceMode;
  publishedAt: string;
  createdAt: string;
}

export interface ChannelFetchStatus {
  channel: Channel;
  status: "live" | "rate_limited" | "bridge_needed" | "simulated" | "error";
  fetched: number;
  note: string;
}

export interface ScanRunRecord {
  id: string;
  workspaceId: string;
  monitorId: string | null;
  triggerType: "manual" | "cron" | "webhook";
  postsFetched: number;
  stage1Dropped: number;
  llmFilteredNoise: number;
  highIntentMatched: number;
  alertsDispatched: number;
  channelStatuses: Record<string, ChannelFetchStatus>;
  createdAt: string;
}

export interface WorkspaceStats {
  totalLeads: number;
  newLeads: number;
  repliedLeads: number;
  noiseBlocked: number;
  alertsSent: number;
  activeMonitors: number;
  avgConfidence: number;
}

export interface Stage1Result {
  passed: boolean;
  reason: string;
  matchedTerms: string[];
}

export interface IntentAnalysis {
  intentType: IntentType;
  confidenceScore: number;
  buyingUrgency: BuyingUrgency;
  reasoning: string;
  painPoints: string[];
  shouldAlert: boolean;
  classifierMode: "llm" | "heuristic";
}

export interface ReplyOutline {
  hook: string;
  valuePoints: string[];
  softMention: string;
  fullDraft: string;
  tone: ReplyTone;
}

export interface SlackPayload {
  text: string;
  blocks: Array<Record<string, unknown>>;
}

export interface DemoEvaluateResponse {
  stage1: Stage1Result;
  analysis: IntentAnalysis;
  reply: ReplyOutline;
  slackPayload: SlackPayload;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  free: boolean;
  database: "postgres" | "memory";
  aiGatewayActive: boolean;
  timestamp: string;
}

export interface AuthMeResponse {
  user: PublicUser;
  workspace: SanitizedWorkspace;
  stats: WorkspaceStats;
  monitors: MonitorRecord[];
  scanRuns: ScanRunRecord[];
}

export interface DispatchResult {
  slackSent: boolean;
  discordSent: boolean;
  errors: string[];
}

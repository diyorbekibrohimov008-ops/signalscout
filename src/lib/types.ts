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

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  companyName: string;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  ownerUserId: string;
  name: string;
  productName: string;
  productDescription: string;
  productUrl: string;
  idealCustomer: string;
  defaultTone: ReplyTone;
  plan: PlanTier;
  trialEndsAt: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  slackWebhookUrl: string;
  discordWebhookUrl: string;
  customOpenaiKey: string;
  xBearerToken: string;
  apifyToken: string;
  ingestSecret: string;
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

export interface RawSocialPost {
  channel: Channel;
  externalId: string;
  author: string;
  authorHandle: string;
  title: string;
  body: string;
  url: string;
  community: string;
  publishedAt: string;
  sourceMode: SourceMode;
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

export interface BillingEventRecord {
  id: string;
  workspaceId: string;
  eventType: string;
  amountCents: number;
  description: string;
  createdAt: string;
}

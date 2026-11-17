import OpenAI from "openai";
import { getEnv } from "./env";
import type { BuyingUrgency, IntentAnalysis, IntentType, MonitorRecord, RawSocialPost, Stage1Result, WorkspaceRecord } from "./types";

const SPAM_PATTERNS = [
  /\bpromo\s*code\b/i,
  /\bdiscount\s*code\b/i,
  /\baffiliate\b/i,
  /\buse\s+my\s+referral\b/i,
  /\bdm\s+me\s+for\s+cheap\b/i,
  /\bclick\s+here\b/i,
  /\bwe\s+are\s+hiring\b/i,
  /\bjob\s+opening\b/i,
];

const LISTICLE_SPAM_PATTERNS = [
  /\btop\s+\d+\s+.*tools\b/i,
  /\bbest\s+\d+\s+.*tools\b/i,
  /\baffiliate\b/i,
  /\bpromo\s*code\b/i,
  /\bsponsored\b/i,
  /\bcheck\s+out\s+my\s+(blog|newsletter|youtube)\b/i,
  /\bjust\s+published\s+(a\s+)?(blog|article|guide)\b/i,
];

const COMPETITOR_COMPLAINT_SIGNALS = [
  "expensive",
  "overpriced",
  "add-on",
  "add on",
  "extra for",
  "charge",
  "charging",
  "flooding",
  "spam",
  "noise",
  "noisy",
  "false positive",
  "false positives",
  "irrelevant",
  "sick of",
  "tired of",
  "annoying",
  "hate",
  "sucks",
  "broken",
  "ridiculous",
  "wild",
  "bumped our bill",
  "moved off",
  "switching off",
  "cancel",
  "canceling",
  "cancelling",
];

const EXPLICIT_BUYING_SIGNALS = [
  "budget",
  "ready to switch",
  "ready to buy",
  "evaluating",
  "this week",
  "asap",
  "looking to buy",
  "willing to pay",
  "need a tool",
  "purchasing",
  "procurement",
  "switch today",
  "trialing",
];

const RECOMMENDATION_SIGNALS = [
  "alternative to",
  "alternatives",
  "looking for",
  "any recommendations",
  "recommendations for",
  "recommend",
  "what do you use",
  "what are you using",
  "anyone moved off",
  "anyone know",
  "suggestions for",
  "best tool for",
  "switched from",
  "replace ",
  "replacing ",
];

export function runStage1Filter(post: RawSocialPost, monitor: MonitorRecord): Stage1Result {
  const haystack = `${post.title}\n${post.body}`.toLowerCase();

  for (const neg of monitor.negativeKeywords) {
    const trimmed = neg.trim().toLowerCase();
    if (trimmed && haystack.includes(trimmed)) {
      return {
        passed: false,
        reason: `Matched negative keyword "${neg}"`,
        matchedTerms: [],
      };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(haystack)) {
      return {
        passed: false,
        reason: "Dropped obvious promotional or hiring pattern before LLM evaluation",
        matchedTerms: [],
      };
    }
  }

  const terms = [...monitor.keywords, ...monitor.competitors]
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (terms.length === 0) {
    return {
      passed: true,
      reason: "No keyword restriction configured",
      matchedTerms: [],
    };
  }

  const matchedTerms = terms.filter((term) => haystack.includes(term));
  if (matchedTerms.length === 0) {
    return {
      passed: false,
      reason: "No keyword or competitor match in post content",
      matchedTerms: [],
    };
  }

  return {
    passed: true,
    reason: `Matched ${matchedTerms.join(", ")}`,
    matchedTerms,
  };
}

export interface ClassifyOptions {
  llmEvaluate?: (
    post: RawSocialPost,
    monitor: MonitorRecord,
    workspace: WorkspaceRecord,
  ) => Promise<Omit<IntentAnalysis, "shouldAlert" | "classifierMode">>;
}

function extractPainPoints(text: string): string[] {
  const lower = text.toLowerCase();
  const points: string[] = [];
  if (/(add-on|add on|extra|expensive|overpriced|price|pricing|bill|\$\d+)/i.test(lower)) {
    points.push("channel add-on pricing");
  }
  if (/(noise|noisy|spam|irrelevant|false positive|flood)/i.test(lower)) {
    points.push("noisy keyword alerts");
  }
  if (/(reply|outreach|draft|shill|manual)/i.test(lower)) {
    points.push("manual outreach burden");
  }
  if (/(twitter|x |linkedin|reddit|hacker news|hn|channel)/i.test(lower)) {
    points.push("multi-channel monitoring");
  }
  if (/(slow|delay|missed|late|real-time|realtime)/i.test(lower)) {
    points.push("alert speed & coverage");
  }
  if (points.length === 0) {
    points.push("evaluating social listening workflow");
  }
  return points;
}

export function classifyIntentHeuristic(
  post: RawSocialPost,
  monitor: MonitorRecord,
): Omit<IntentAnalysis, "shouldAlert" | "classifierMode"> {
  const combined = `${post.title} ${post.body}`.trim();
  const lower = combined.toLowerCase();

  if (LISTICLE_SPAM_PATTERNS.some((re) => re.test(lower))) {
    return {
      intentType: "noise_or_irrelevant",
      confidenceScore: 22,
      buyingUrgency: "low",
      reasoning: "Looks like promotional content, a listicle, or affiliate link drop rather than a buyer.",
      painPoints: [],
    };
  }

  const hasNegative = monitor.negativeKeywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase()));
  if (hasNegative) {
    return {
      intentType: "noise_or_irrelevant",
      confidenceScore: 15,
      buyingUrgency: "low",
      reasoning: "Contains excluded negative keyword.",
      painPoints: [],
    };
  }

  const competitorList = [...monitor.competitors.map((c) => c.toLowerCase()), "syften", "octolens", "f5bot", "brand24"];
  const mentionsCompetitor = competitorList.some((c) => c && lower.includes(c));
  const complaintHits = COMPETITOR_COMPLAINT_SIGNALS.filter((s) => lower.includes(s)).length;
  const buyingHits = EXPLICIT_BUYING_SIGNALS.filter((s) => lower.includes(s)).length;
  const recHits = RECOMMENDATION_SIGNALS.filter((s) => lower.includes(s)).length + (combined.includes("?") ? 1 : 0);

  const painPoints = extractPainPoints(combined);

  let intentType: IntentType = "noise_or_irrelevant";
  let confidenceScore = 40;
  let buyingUrgency: BuyingUrgency = "low";
  let reasoning = "Mentions tracked terms without clear buying or switching intent.";

  if (buyingHits >= 2 || (buyingHits >= 1 && (recHits >= 1 || mentionsCompetitor))) {
    intentType = "explicit_buying_intent";
    confidenceScore = Math.min(97, 78 + buyingHits * 6 + (mentionsCompetitor ? 5 : 0));
    buyingUrgency = "high";
    reasoning = "Author expresses active evaluation, budget, or immediate readiness to purchase/switch.";
  } else if (mentionsCompetitor && complaintHits >= 1) {
    intentType = "competitor_complaint";
    confidenceScore = Math.min(96, 77 + complaintHits * 6 + (recHits >= 1 ? 5 : 0));
    buyingUrgency = complaintHits >= 2 || recHits >= 1 ? "high" : "medium";
    reasoning = "Author expresses frustration with an incumbent monitoring tool's pricing, noise, or workflow.";
  } else if (recHits >= 2 || (recHits >= 1 && (mentionsCompetitor || painPoints.length >= 1))) {
    intentType = "recommendation_request";
    confidenceScore = Math.min(93, 72 + recHits * 6 + (mentionsCompetitor ? 6 : 0));
    buyingUrgency = mentionsCompetitor || buyingHits > 0 ? "high" : "medium";
    reasoning = "Author is actively asking peers for product recommendations or alternatives.";
  } else if (buyingHits === 1) {
    intentType = "explicit_buying_intent";
    confidenceScore = 76;
    buyingUrgency = "medium";
    reasoning = "Author indicates active tool evaluation or near-term buying intent.";
  } else if (combined.includes("?") && (lower.includes("tool") || lower.includes("software") || lower.includes("monitor"))) {
    intentType = "recommendation_request";
    confidenceScore = 71;
    buyingUrgency = "medium";
    reasoning = "Author asks a tool-selection question related to tracked keywords.";
  }

  return {
    intentType,
    confidenceScore,
    buyingUrgency,
    reasoning,
    painPoints,
  };
}

async function callOpenAiIntentClassifier(
  post: RawSocialPost,
  monitor: MonitorRecord,
  workspace: WorkspaceRecord,
): Promise<Omit<IntentAnalysis, "shouldAlert" | "classifierMode"> | null> {
  const customKey = workspace.customOpenaiKey.trim();
  const envKey = getEnv("OPENAI_API_KEY");
  const gatewayUrl = getEnv("OPENAI_BASE_URL");

  if (!customKey && !envKey && !gatewayUrl) {
    return null;
  }

  const client = customKey ? new OpenAI({ apiKey: customKey }) : new OpenAI();
  const model = getEnv("SIGNALSCOUT_LLM_MODEL") || "gpt-4o-mini";

  const prompt = [
    `Classify whether this social post shows genuine B2B/SaaS buying intent for "${workspace.productName || monitor.name}".`,
    `Product context: ${workspace.productDescription || "Social media buying-intent monitoring tool"}`,
    `Tracked keywords: ${monitor.keywords.join(", ")}`,
    `Tracked competitors: ${monitor.competitors.join(", ")}`,
    ``,
    `Channel: ${post.channel} (${post.community})`,
    `Title: ${post.title}`,
    `Body: ${post.body.slice(0, 1200)}`,
    ``,
    `Return strict JSON with keys:`,
    `- intentType: "recommendation_request" | "competitor_complaint" | "explicit_buying_intent" | "noise_or_irrelevant"`,
    `- confidenceScore: integer 0..100`,
    `- buyingUrgency: "high" | "medium" | "low"`,
    `- reasoning: 1 concise sentence explaining why`,
    `- painPoints: array of 1-3 short strings`,
  ].join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precision buying-intent classifier. Reject SEO listicles, promo spam, hiring posts, and casual chatter as noise_or_irrelevant.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<Omit<IntentAnalysis, "shouldAlert" | "classifierMode">>;

  const validTypes: IntentType[] = [
    "recommendation_request",
    "competitor_complaint",
    "explicit_buying_intent",
    "noise_or_irrelevant",
  ];
  const intentType = validTypes.includes(parsed.intentType as IntentType)
    ? (parsed.intentType as IntentType)
    : "noise_or_irrelevant";

  const confidenceScore = Math.max(0, Math.min(100, Math.round(Number(parsed.confidenceScore ?? 50))));
  const buyingUrgency: BuyingUrgency =
    parsed.buyingUrgency === "high" || parsed.buyingUrgency === "low" ? parsed.buyingUrgency : "medium";

  return {
    intentType,
    confidenceScore,
    buyingUrgency,
    reasoning: typeof parsed.reasoning === "string" && parsed.reasoning ? parsed.reasoning : "Classified by LLM intent filter.",
    painPoints: Array.isArray(parsed.painPoints)
      ? parsed.painPoints.filter((p): p is string => typeof p === "string").slice(0, 4)
      : [],
  };
}

export async function classifyIntent(
  post: RawSocialPost,
  monitor: MonitorRecord,
  workspace: WorkspaceRecord,
  options: ClassifyOptions = {},
): Promise<IntentAnalysis> {
  if (options.llmEvaluate) {
    try {
      const llm = await options.llmEvaluate(post, monitor, workspace);
      return {
        ...llm,
        shouldAlert: llm.intentType !== "noise_or_irrelevant" && llm.confidenceScore >= monitor.minConfidence,
        classifierMode: "llm",
      };
    } catch {
      // Fall back to deterministic scorer on upstream failure
    }
  } else {
    try {
      const llm = await callOpenAiIntentClassifier(post, monitor, workspace);
      if (llm) {
        return {
          ...llm,
          shouldAlert: llm.intentType !== "noise_or_irrelevant" && llm.confidenceScore >= monitor.minConfidence,
          classifierMode: "llm",
        };
      }
    } catch {
      // Fall back to deterministic scorer if gateway/API key fails
    }
  }

  const heuristic = classifyIntentHeuristic(post, monitor);
  return {
    ...heuristic,
    shouldAlert: heuristic.intentType !== "noise_or_irrelevant" && heuristic.confidenceScore >= monitor.minConfidence,
    classifierMode: "heuristic",
  };
}

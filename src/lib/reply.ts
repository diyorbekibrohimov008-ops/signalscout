import type { IntentAnalysis, RawSocialPost, ReplyOutline, ReplyTone, WorkspaceRecord } from "./types";

function cleanProductName(workspace: WorkspaceRecord): string {
  const name = workspace.productName?.trim();
  return name && name.length > 0 ? name : "our tool";
}

function buildHook(post: RawSocialPost, analysis: IntentAnalysis, tone: ReplyTone): string {
  const primaryPain = analysis.painPoints[0] || "filtering real buyer threads from noise";
  const authorFirst = post.author?.replace(/^u\/|^@/, "").split(/\s+/)[0] || "there";

  if (analysis.intentType === "competitor_complaint") {
    if (tone === "technical") {
      return `Totally feel this — ${primaryPain} is usually where simple keyword matchers break down once volume scales.`;
    }
    if (tone === "peer") {
      return `Hey ${authorFirst}, ran into this exact headache with ${primaryPain} too.`;
    }
    return `Totally hear you on ${primaryPain} — paying extra per channel only to still dig through false positives is exhausting.`;
  }

  if (analysis.intentType === "explicit_buying_intent") {
    if (tone === "technical") {
      return `If you're evaluating options right now, the biggest lever for ${primaryPain} is separating keyword recall from intent scoring.`;
    }
    return `Since you're actively comparing tools this week, happy to share what actually works for ${primaryPain}.`;
  }

  if (tone === "peer") {
    return `Went through a similar search recently when ${primaryPain} started eating too much time.`;
  }
  if (tone === "technical") {
    return `Good question — most teams hit a wall with ${primaryPain} when they rely on raw keyword alerts alone.`;
  }
  return `Saw your question — dealing with ${primaryPain} is the exact reason most folks start looking for a cleaner setup.`;
}

function buildValuePoints(post: RawSocialPost, analysis: IntentAnalysis, tone: ReplyTone): string[] {
  const points: string[] = [];

  if (analysis.painPoints.includes("noisy keyword alerts") || analysis.intentType === "competitor_complaint") {
    points.push(
      tone === "technical"
        ? "Run a two-stage filter: cheap negative-keyword drop first, then LLM intent classification (recommendation request vs promo spam) before Slack."
        : "Separate keyword matching from intent filtering so listicles, hiring posts, and random mentions never ping Slack.",
    );
  } else {
    points.push(
      tone === "technical"
        ? "Score threads by explicit intent (asking for alternatives, competitor pain, or active evaluation) rather than raw keyword frequency."
        : "Prioritize threads where someone is asking for recommendations or unhappy with a current tool rather than general chatter.",
    );
  }

  if (analysis.painPoints.includes("channel add-on pricing") || post.channel === "x" || post.channel === "linkedin") {
    points.push("Watch out for tools that charge base + $40/mo X + $20/mo add-ons — flat multi-channel pricing keeps costs predictable.");
  } else {
    points.push("Pre-draft a non-salesy outline inside the alert so you can personalize and reply in 30 seconds instead of staring at a blank box.");
  }

  if (tone === "technical" && post.channel === "hackernews") {
    points.push("Deduplicate by thread/comment ID and keep a blocked-noise audit log so you can tune negative keywords with real data.");
  }

  return points.slice(0, 3);
}

function buildSoftMention(workspace: WorkspaceRecord, tone: ReplyTone): string {
  const product = cleanProductName(workspace);
  const urlPart = workspace.productUrl?.trim() ? ` (${workspace.productUrl.trim()})` : "";
  const desc = workspace.productDescription?.trim()
    ? workspace.productDescription.trim().replace(/\.$/, "")
    : "handles all-channel monitoring with LLM intent filtering and reply outlines";

  if (tone === "peer") {
    return `Worth checking out ${product}${urlPart} — ${desc.toLowerCase()}. Happy to share how we configured our filters if helpful.`;
  }
  if (tone === "technical") {
    return `Full disclosure: I'm building ${product}${urlPart}, which implements this two-stage pipeline (${desc.toLowerCase()}). Happy to walk through the architecture or share tradeoffs vs DIY.`;
  }
  return `Full disclosure: I'm building ${product}${urlPart} to solve this exact workflow — ${desc.toLowerCase()}. Happy to set up a test monitor for your keywords if you want to compare.`;
}

export function generateReplyOutline(
  post: RawSocialPost,
  analysis: IntentAnalysis,
  workspace: WorkspaceRecord,
  requestedTone?: ReplyTone,
): ReplyOutline {
  const tone: ReplyTone = requestedTone || workspace.defaultTone || "founder";
  const hook = buildHook(post, analysis, tone);
  const valuePoints = buildValuePoints(post, analysis, tone);
  const softMention = buildSoftMention(workspace, tone);

  if (post.channel === "x") {
    const conciseValue = valuePoints[0];
    const product = cleanProductName(workspace);
    const shortDisclosure =
      workspace.productName?.trim()
        ? `Disclosure: building ${product} (flat $25/mo across X/Reddit/HN/LI with LLM noise filter) if you want to compare.`
        : softMention;
    const fullDraft = `${hook}\n\n${conciseValue}\n\n${shortDisclosure}`;
    return {
      hook,
      valuePoints,
      softMention: shortDisclosure,
      fullDraft,
      tone,
    };
  }

  const bullets = valuePoints.map((pt) => `- ${pt}`).join("\n");
  const fullDraft = `${hook}\n\nA couple of things that help:\n${bullets}\n\n${softMention}`;

  return {
    hook,
    valuePoints,
    softMention,
    fullDraft,
    tone,
  };
}

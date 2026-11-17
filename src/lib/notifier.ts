import type { LeadRecord, MonitorRecord, WorkspaceRecord } from "./types";

const INTENT_LABELS: Record<LeadRecord["intentType"], string> = {
  recommendation_request: "Recommendation Request",
  competitor_complaint: "Competitor Complaint",
  explicit_buying_intent: "Explicit Buying Intent",
  noise_or_irrelevant: "Filtered Noise",
};

const CHANNEL_LABELS: Record<LeadRecord["channel"], string> = {
  reddit: "Reddit",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  hackernews: "Hacker News",
};

export interface SlackPayload {
  text: string;
  blocks: Array<Record<string, unknown>>;
}

export interface DiscordPayload {
  content: string;
  embeds: Array<Record<string, unknown>>;
}

export function buildSlackPayload(lead: LeadRecord, monitor: MonitorRecord): SlackPayload {
  const channelLabel = CHANNEL_LABELS[lead.channel];
  const intentLabel = INTENT_LABELS[lead.intentType];
  const headerText = `${channelLabel} • ${intentLabel} (${lead.confidenceScore}/100)`;
  const headline = lead.title ? `*${lead.title}*\n` : "";
  const excerpt = lead.body.length > 360 ? `${lead.body.slice(0, 357)}...` : lead.body;

  return {
    text: `[SignalScout] ${headerText}: ${lead.title || lead.body.slice(0, 90)}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: headerText,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Monitor:*\n${monitor.name}` },
          { type: "mrkdwn", text: `*Source:*\n${lead.community || channelLabel} (${lead.authorHandle || lead.author})` },
          { type: "mrkdwn", text: `*Urgency:*\n${lead.buyingUrgency.toUpperCase()}` },
          { type: "mrkdwn", text: `*Confidence:*\n${lead.confidenceScore}/100` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${headline}> ${excerpt.replace(/\n+/g, "\n> ")}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Why this passed LLM filter:* ${lead.reasoning}`,
          },
        ],
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Contextual Reply Outline (${lead.replyTone} tone — edit & post in seconds):*\n\`\`\`${lead.replyDraft}\`\`\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Thread",
            },
            url: lead.url,
            style: "primary",
          },
        ],
      },
    ],
  };
}

export function buildDiscordPayload(lead: LeadRecord, monitor: MonitorRecord): DiscordPayload {
  const channelLabel = CHANNEL_LABELS[lead.channel];
  const intentLabel = INTENT_LABELS[lead.intentType];
  const color = lead.buyingUrgency === "high" ? 0x10b981 : 0xf59e0b;
  const excerpt = lead.body.length > 400 ? `${lead.body.slice(0, 397)}...` : lead.body;

  return {
    content: `**SignalScout Buying Signal** — ${channelLabel} (${lead.confidenceScore}/100)`,
    embeds: [
      {
        title: lead.title || `${channelLabel} post by ${lead.authorHandle || lead.author}`,
        url: lead.url,
        description: excerpt,
        color,
        fields: [
          { name: "Monitor", value: monitor.name, inline: true },
          { name: "Intent", value: `${intentLabel} (${lead.confidenceScore}/100)`, inline: true },
          { name: "Urgency", value: lead.buyingUrgency.toUpperCase(), inline: true },
          { name: "Why Matched", value: lead.reasoning, inline: false },
          {
            name: `Contextual Reply Outline (${lead.replyTone})`,
            value: `Hook: ${lead.replyHook}\n\n${lead.replyDraft.slice(0, 900)}`,
            inline: false,
          },
        ],
        footer: { text: `SignalScout • ${lead.community || channelLabel}` },
      },
    ],
  };
}

export function isSafeWebhookEndpoint(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80") ||
      host.includes(":")
    ) {
      return false;
    }
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const p = ipv4.slice(1).map(Number);
      if (
        p.some((n) => n > 255) ||
        p[0] === 10 ||
        p[0] === 127 ||
        p[0] === 0 ||
        (p[0] === 169 && p[1] === 254) ||
        (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
        (p[0] === 192 && p[1] === 168) ||
        (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function dispatchWebhookAlerts(
  lead: LeadRecord,
  monitor: MonitorRecord,
  workspace: WorkspaceRecord,
  fetchFn: typeof fetch = fetch,
): Promise<{ slackSent: boolean; discordSent: boolean; errors: string[] }> {
  let slackSent = false;
  let discordSent = false;
  const errors: string[] = [];

  const slackUrl = workspace.slackWebhookUrl.trim();
  if (slackUrl) {
    if (fetchFn === fetch && !isSafeWebhookEndpoint(slackUrl)) {
      errors.push("Slack webhook blocked: URL must be a public https:// endpoint.");
    } else {
      try {
        const res = await fetchFn(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSlackPayload(lead, monitor)),
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          slackSent = true;
        } else {
          errors.push(`Slack webhook returned HTTP ${res.status}`);
        }
      } catch (err) {
        errors.push(`Slack webhook failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const discordUrl = workspace.discordWebhookUrl.trim();
  if (discordUrl) {
    if (fetchFn === fetch && !isSafeWebhookEndpoint(discordUrl)) {
      errors.push("Discord webhook blocked: URL must be a public https:// endpoint.");
    } else {
      try {
        const res = await fetchFn(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildDiscordPayload(lead, monitor)),
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          discordSent = true;
        } else {
          errors.push(`Discord webhook returned HTTP ${res.status}`);
        }
      } catch (err) {
        errors.push(`Discord webhook failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { slackSent, discordSent, errors };
}

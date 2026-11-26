import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

export const SESSION_COOKIE_NAME = "ss_session";

export interface SessionPayload {
  userId: string;
  workspaceId: string;
  email: string;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${salt}$${derived}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derived = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

const DETERMINISTIC_FALLBACK_SECRET = createHash("sha256")
  .update(
    `signalscout-session::${
      getEnv("VERCEL_PROJECT_ID") || getEnv("SITE_ID") || "local-dev-workspace"
    }`,
  )
  .digest("hex");

export function getSessionSecret(): string {
  return getEnv("SESSION_SECRET") || DETERMINISTIC_FALLBACK_SECRET;
}

export async function signSessionToken(
  claims: { userId: string; workspaceId: string; email: string },
  secret: string = getSessionSecret(),
  ttlSeconds: number = 60 * 60 * 24 * 7,
): Promise<string> {
  const payload: SessionPayload = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const sig = toBase64Url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export async function verifySessionToken(
  token: string,
  secret: string = getSessionSecret(),
): Promise<SessionPayload | null> {
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const body = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!body || !sig) return null;

  const expectedSig = createHmac("sha256", secret).update(body).digest();
  const actualSig = fromBase64Url(sig);
  if (actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(body).toString("utf8")) as SessionPayload;
    if (!parsed.userId || !parsed.workspaceId || !parsed.exp) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const segment of header.split(";")) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim();
    const val = segment.slice(eq + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number = 60 * 60 * 24 * 7): string {
  const secureFlag = getEnv("CONTEXT") === "production" || getEnv("NODE_ENV") === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

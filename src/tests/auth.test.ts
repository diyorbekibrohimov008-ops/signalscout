import { describe, expect, it } from "vitest";
import { hashPassword, parseCookieHeader, signSessionToken, verifyPassword, verifySessionToken } from "../lib/auth";

describe("Authentication & Signed Session Tokens", () => {
  it("hashes and verifies passwords with per-user salts", async () => {
    const hash1 = await hashPassword("super-secret-pass");
    const hash2 = await hashPassword("super-secret-pass");

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword("super-secret-pass", hash1)).toBe(true);
    expect(await verifyPassword("wrong-password", hash1)).toBe(false);
  });

  it("signs, verifies, and rejects tampered or expired session tokens", async () => {
    const secret = "test-signing-secret-32-chars-minimum";
    const token = await signSessionToken(
      { userId: "usr_1", workspaceId: "ws_1", email: "founder@acme.com" },
      secret,
      3600,
    );

    const verified = await verifySessionToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("usr_1");
    expect(verified?.workspaceId).toBe("ws_1");

    const tampered = `${token.slice(0, -4)}xxxx`;
    expect(await verifySessionToken(tampered, secret)).toBeNull();

    const expired = await signSessionToken(
      { userId: "usr_1", workspaceId: "ws_1", email: "founder@acme.com" },
      secret,
      -10,
    );
    expect(await verifySessionToken(expired, secret)).toBeNull();
  });

  it("parses cookie header values safely", () => {
    const parsed = parseCookieHeader("foo=bar; ss_session=abc.123; theme=dark");
    expect(parsed.ss_session).toBe("abc.123");
    expect(parsed.theme).toBe("dark");
  });
});

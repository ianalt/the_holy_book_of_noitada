// Task T-007: GoogleProvider / DiscordProvider + signed single-use state.
// Covers AC1/AC2 (authorize URLs with the backend redirect URI + state), AC5
// (state CSRF validation), and AC4 (emailVerified mapping). Network calls are
// mocked so exchangeCode/fetchProfile are exercised without hitting the providers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscordProvider } from "../../../apps/api/src/modules/auth/infrastructure/providers/discord.provider";
import { GoogleProvider } from "../../../apps/api/src/modules/auth/infrastructure/providers/google.provider";
import { StateService } from "../../../apps/api/src/modules/auth/infrastructure/providers/state";

const GOOGLE_REDIRECT = "http://localhost:3001/auth/google/callback";
const DISCORD_REDIRECT = "http://localhost:3001/auth/discord/callback";

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(data) } as unknown as Response;
}

describe("StateService (AC5: signed, single-use, CSRF)", () => {
  const state = new StateService({ secret: "state-secret" });

  it("a freshly issued state validates against itself", () => {
    const s = state.issue();
    expect(state.validate(s, s)).toBe(true);
  });

  it("rejects when the query state does not match the cookie (CSRF)", () => {
    const s = state.issue();
    const other = state.issue();
    expect(state.validate(s, other)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const s = state.issue();
    const tampered = `${s.slice(0, -2)}xx`;
    expect(state.validate(tampered, tampered)).toBe(false);
  });

  it("rejects a state signed with a different secret", () => {
    const foreign = new StateService({ secret: "attacker-secret" }).issue();
    expect(state.validate(foreign, foreign)).toBe(false);
  });

  it("rejects an expired state", () => {
    const shortLived = new StateService({ secret: "state-secret", ttlSeconds: -1 });
    const s = shortLived.issue();
    expect(shortLived.validate(s, s)).toBe(false);
  });

  it("rejects empty inputs", () => {
    expect(state.validate("", "")).toBe(false);
    expect(state.validate(state.issue(), "")).toBe(false);
  });

  it("requires a non-empty secret", () => {
    expect(() => new StateService({ secret: "" })).toThrow(/non-empty secret/);
  });
});

describe("GoogleProvider.authorizeUrl (AC1)", () => {
  const provider = new GoogleProvider({ clientId: "gid", clientSecret: "gsecret" });

  it("targets Google with the backend redirect URI, state and code flow", () => {
    const url = new URL(provider.authorizeUrl({ state: "st-1", redirectUri: GOOGLE_REDIRECT }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("gid");
    expect(url.searchParams.get("redirect_uri")).toBe(GOOGLE_REDIRECT);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st-1");
    expect(url.searchParams.get("scope")).toContain("email");
  });
});

describe("DiscordProvider.authorizeUrl (AC2)", () => {
  const provider = new DiscordProvider({ clientId: "did", clientSecret: "dsecret" });

  it("targets Discord with the backend redirect URI, state and code flow", () => {
    const url = new URL(provider.authorizeUrl({ state: "st-2", redirectUri: DISCORD_REDIRECT }));
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("did");
    expect(url.searchParams.get("redirect_uri")).toBe(DISCORD_REDIRECT);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st-2");
    expect(url.searchParams.get("scope")).toContain("email");
  });
});

describe("provider token exchange + profile (AC4, AC5 invalid code)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Google: exchangeCode maps tokens, fetchProfile maps verified email (AC4)", async () => {
    const provider = new GoogleProvider({ clientId: "gid", clientSecret: "gsecret" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: "g-access", id_token: "g-id" }));
    const tokens = await provider.exchangeCode({ code: "code-1", redirectUri: GOOGLE_REDIRECT });
    expect(tokens).toEqual({ accessToken: "g-access", idToken: "g-id" });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("oauth2.googleapis.com/token");

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ sub: "g-123", email: "u@example.com", email_verified: true, name: "U" }),
    );
    const profile = await provider.fetchProfile(tokens);
    expect(profile).toEqual({
      provider: "google",
      providerUserId: "g-123",
      email: "u@example.com",
      emailVerified: true,
      displayName: "U",
    });
  });

  it("Google: exchangeCode throws on an invalid/expired code (AC5)", async () => {
    const provider = new GoogleProvider({ clientId: "gid", clientSecret: "gsecret" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid_grant" }, false, 400));
    await expect(
      provider.exchangeCode({ code: "bad", redirectUri: GOOGLE_REDIRECT }),
    ).rejects.toThrow(/token exchange failed/);
  });

  it("Discord: fetchProfile reflects the verified flag (AC4)", async () => {
    const provider = new DiscordProvider({ clientId: "did", clientSecret: "dsecret" });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "d-1", email: "d@example.com", verified: true, global_name: "Dee" }),
    );
    const verified = await provider.fetchProfile({ accessToken: "d-access" });
    expect(verified.emailVerified).toBe(true);
    expect(verified).toMatchObject({
      provider: "discord",
      providerUserId: "d-1",
      displayName: "Dee",
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "d-2", email: "d2@example.com", verified: false, username: "dee2" }),
    );
    const unverified = await provider.fetchProfile({ accessToken: "d-access" });
    expect(unverified.emailVerified).toBe(false);
    expect(unverified.displayName).toBe("dee2");
  });
});

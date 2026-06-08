// Task T-005: JwtTokenService + cookie helpers.
// Covers AC8 (issue / rotate / verify), the NFR token TTLs, and the security
// constraint on cookie flags (HttpOnly, Secure, SameSite=Lax).
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  buildAuthCookie,
  buildClearCookie,
  serializeCookie,
} from "../../../apps/api/src/modules/auth/infrastructure/http/cookie.helper";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JwtTokenService,
  REFRESH_TOKEN_TTL_SECONDS,
  sha256,
} from "../../../apps/api/src/modules/auth/infrastructure/token/jwt-token.service";

const SECRET = "test-secret-please-ignore";

function decode(token: string): jwt.JwtPayload {
  return jwt.decode(token) as jwt.JwtPayload;
}

describe("JwtTokenService.issuePair (AC8, NFR TTLs)", () => {
  const service = new JwtTokenService({ secret: SECRET });

  it("issues an access token carrying sub + role", async () => {
    const { accessToken } = await service.issuePair({ userId: "u1", role: "member" });
    const payload = decode(accessToken);
    expect(payload.sub).toBe("u1");
    expect(payload.role).toBe("member");
    expect(payload.type).toBe("access");
  });

  it("stores only the SHA-256 hash of the refresh token (security)", async () => {
    const issued = await service.issuePair({ userId: "u1", role: "member" });
    expect(issued.refreshTokenHash).toBe(sha256(issued.refreshToken));
    expect(issued.refreshTokenHash).not.toBe(issued.refreshToken);
  });

  it("uses ~15m access and ~7d refresh TTLs (NFR)", async () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    const { accessToken, refreshToken } = await service.issuePair({ userId: "u1", role: "member" });
    const access = decode(accessToken);
    const refresh = decode(refreshToken);
    expect((access.exp as number) - (access.iat as number)).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect((refresh.exp as number) - (refresh.iat as number)).toBe(REFRESH_TOKEN_TTL_SECONDS);
  });

  it("produces a distinct refresh token + hash on every issue (rotation, AC8)", async () => {
    const a = await service.issuePair({ userId: "u1", role: "member" });
    const b = await service.issuePair({ userId: "u1", role: "member" });
    expect(a.refreshToken).not.toBe(b.refreshToken);
    expect(a.refreshTokenHash).not.toBe(b.refreshTokenHash);
  });
});

describe("JwtTokenService verify (AC6/AC7, AC8)", () => {
  const service = new JwtTokenService({ secret: SECRET });

  it("verifyAccess returns the principal for a valid access token", async () => {
    const { accessToken } = await service.issuePair({ userId: "u1", role: "admin" });
    expect(service.verifyAccess(accessToken)).toEqual({ id: "u1", role: "admin" });
  });

  it("verifyAccess rejects a tampered or wrong-secret token", async () => {
    const other = new JwtTokenService({ secret: "different-secret" });
    const { accessToken } = await other.issuePair({ userId: "u1", role: "member" });
    expect(() => service.verifyAccess(accessToken)).toThrow();
  });

  it("verifyAccess rejects a refresh token (wrong type)", async () => {
    const { refreshToken } = await service.issuePair({ userId: "u1", role: "member" });
    expect(() => service.verifyAccess(refreshToken)).toThrow(/Not a valid access token/);
  });

  it("verifyAccess rejects an expired token", () => {
    const shortLived = new JwtTokenService({ secret: SECRET, accessTokenTtlSeconds: -1 });
    const expired = jwt.sign({ sub: "u1", role: "member", type: "access" }, SECRET, {
      expiresIn: -1,
    });
    expect(() => shortLived.verifyAccess(expired)).toThrow();
  });

  it("verifyRefresh returns userId + the lookup hash, and rejects invalid (AC8)", async () => {
    const { refreshToken, refreshTokenHash } = await service.issuePair({
      userId: "u1",
      role: "member",
    });
    expect(service.verifyRefresh(refreshToken)).toEqual({
      userId: "u1",
      tokenHash: refreshTokenHash,
    });
    expect(() => service.verifyRefresh("not-a-jwt")).toThrow();
  });

  it("rejects an empty secret at construction", () => {
    expect(() => new JwtTokenService({ secret: "" })).toThrow(/non-empty secret/);
  });
});

describe("cookie helpers (security flags, AC9)", () => {
  it("auth cookies are HttpOnly, Secure, SameSite=Lax, Path=/ (security)", () => {
    const cookie = buildAuthCookie(
      ACCESS_TOKEN_COOKIE,
      "jwt-value",
      true,
      ACCESS_TOKEN_TTL_SECONDS,
    );
    const header = serializeCookie(cookie);
    expect(header).toContain("access_token=jwt-value");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toContain(`Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`);
  });

  it("omits Secure only when explicitly relaxed (dev over http)", () => {
    expect(serializeCookie(buildAuthCookie(REFRESH_TOKEN_COOKIE, "v", false, 10))).not.toContain(
      "Secure",
    );
    expect(serializeCookie(buildAuthCookie(REFRESH_TOKEN_COOKIE, "v", true, 10))).toContain(
      "Secure",
    );
  });

  it("clear cookie empties the value and sets Max-Age=0 (AC9 logout)", () => {
    const header = serializeCookie(buildClearCookie(ACCESS_TOKEN_COOKIE, true));
    expect(header).toContain("access_token=;");
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("HttpOnly");
  });
});

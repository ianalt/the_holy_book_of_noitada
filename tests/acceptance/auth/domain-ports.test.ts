// Task T-004: domain ports IOAuthProvider and ITokenService. The ports are pure
// interfaces; here minimal conforming fakes exercise the contracts so the AC1/AC2
// (authorize URL) and AC8 (issue + rotate + verify) shapes are pinned down. Real
// implementations land in T-005 (token service) and T-007 (providers).
import { describe, expect, it } from "vitest";
import type {
  IAuthorizeUrlParams,
  IExchangeCodeParams,
  IOAuthProvider,
  IOAuthTokens,
} from "../../../apps/api/src/modules/auth/domain/ports/o-auth-provider.port";
import type {
  IIssueTokensInput,
  IIssuedTokens,
  IRefreshTokenClaims,
  ITokenService,
} from "../../../apps/api/src/modules/auth/domain/ports/token-service.port";
import type { ICurrentUser } from "../../../apps/api/src/modules/auth/domain/types/current-user.type";
import type { IOAuthProfile } from "../../../apps/api/src/modules/auth/domain/types/o-auth-profile.type";

const BACKEND_REDIRECT = "http://localhost:3001/auth/google/callback";

class FakeGoogleProvider implements IOAuthProvider {
  readonly name = "google" as const;

  authorizeUrl(params: IAuthorizeUrlParams): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  exchangeCode(_params: IExchangeCodeParams): Promise<IOAuthTokens> {
    return Promise.resolve({ accessToken: "provider-access-token" });
  }

  fetchProfile(_tokens: IOAuthTokens): Promise<IOAuthProfile> {
    return Promise.resolve({
      provider: "google",
      providerUserId: "sub-1",
      email: "user@example.com",
      emailVerified: true,
    });
  }
}

class FakeTokenService implements ITokenService {
  issuePair(input: IIssueTokensInput): Promise<IIssuedTokens> {
    return Promise.resolve({
      accessToken: `access:${input.userId}:${input.role}`,
      refreshToken: "refresh-raw",
      refreshTokenHash: "sha256-of-refresh-raw",
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
  }

  verifyAccess(token: string): ICurrentUser {
    const [, id, role] = token.split(":");
    if (!id) throw new Error("invalid access token");
    return { id, role: role ?? "member" };
  }

  verifyRefresh(token: string): IRefreshTokenClaims {
    if (token !== "refresh-raw") throw new Error("invalid refresh token");
    return { userId: "u1", tokenHash: "sha256-of-refresh-raw" };
  }
}

describe("IOAuthProvider contract (AC1, AC2)", () => {
  const provider = new FakeGoogleProvider();

  it("authorizeUrl embeds the backend redirect URI and the state (AC1, AC2)", () => {
    const url = new URL(
      provider.authorizeUrl({ state: "state-xyz", redirectUri: BACKEND_REDIRECT }),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(BACKEND_REDIRECT);
    expect(url.searchParams.get("state")).toBe("state-xyz");
  });

  it("exchangeCode then fetchProfile yields a normalized profile with emailVerified (AC4 support)", async () => {
    const tokens = await provider.exchangeCode({
      code: "auth-code",
      redirectUri: BACKEND_REDIRECT,
    });
    expect(tokens.accessToken).toBeTruthy();
    const profile = await provider.fetchProfile(tokens);
    expect(profile.provider).toBe("google");
    expect(profile.emailVerified).toBe(true);
  });
});

describe("ITokenService contract (AC8)", () => {
  const service = new FakeTokenService();

  it("issuePair returns the raw pair plus persistence metadata (hash + expiry)", async () => {
    const issued = await service.issuePair({ userId: "u1", role: "member" });
    expect(issued.accessToken).toBeTruthy();
    expect(issued.refreshToken).toBeTruthy();
    expect(issued.refreshTokenHash).toBeTruthy();
    expect(issued.refreshTokenExpiresAt).toBeInstanceOf(Date);
  });

  it("verifyAccess returns the current-user principal (AC6/AC7 foundation)", () => {
    expect(service.verifyAccess("access:u1:member")).toEqual({ id: "u1", role: "member" });
  });

  it("verifyRefresh returns the lookup hash on success and throws on invalid (AC8)", () => {
    expect(service.verifyRefresh("refresh-raw").tokenHash).toBe("sha256-of-refresh-raw");
    expect(() => service.verifyRefresh("tampered")).toThrow(/invalid refresh token/);
  });
});

// Task T-009: HandleOAuthCallback use case. Covers AC3 (first login creates User
// + OAuthAccount + member role), AC4 (link a new provider to an existing User by
// verified email; returning same-provider login), and AC5 (invalid state / code /
// unverified email => no session). Repos and provider are in-memory fakes; the
// real StateService validates state.
import { describe, expect, it } from "vitest";
import {
  HandleOAuthCallback,
  OAuthCallbackError,
} from "../../../apps/api/src/modules/auth/application/handle-oauth-callback.usecase";
import { OAuthAccount } from "../../../apps/api/src/modules/auth/domain/entities/o-auth-account.entity";
import { User } from "../../../apps/api/src/modules/auth/domain/entities/user.entity";
import type {
  IAuthorizeUrlParams,
  IOAuthProvider,
  IOAuthTokens,
} from "../../../apps/api/src/modules/auth/domain/ports/o-auth-provider.port";
import type {
  IIssueTokensInput,
  IIssuedTokens,
  IRefreshTokenClaims,
  ITokenService,
} from "../../../apps/api/src/modules/auth/domain/ports/token-service.port";
import {
  type ICreateOAuthAccountInput,
  OAuthAccountRepository,
} from "../../../apps/api/src/modules/auth/domain/repositories/o-auth-account.repository";
import {
  type ICreateRefreshTokenInput,
  type IRefreshTokenRecord,
  RefreshTokenRepository,
} from "../../../apps/api/src/modules/auth/domain/repositories/refresh-token.repository";
import {
  type ICreateUserInput,
  UserRepository,
} from "../../../apps/api/src/modules/auth/domain/repositories/user.repository";
import type { ICurrentUser } from "../../../apps/api/src/modules/auth/domain/types/current-user.type";
import type { IOAuthProfile } from "../../../apps/api/src/modules/auth/domain/types/o-auth-profile.type";
import { Email } from "../../../apps/api/src/modules/auth/domain/value-objects/email.vo";
import type { IProviderName } from "../../../apps/api/src/modules/auth/domain/value-objects/provider.vo";
import { Provider } from "../../../apps/api/src/modules/auth/domain/value-objects/provider.vo";
import { StateService } from "../../../apps/api/src/modules/auth/infrastructure/providers/state";

const REDIRECT = "http://localhost:3001/auth/google/callback";

class InMemoryUserRepository extends UserRepository {
  readonly rows: User[] = [];
  private seq = 0;

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.rows.find((u) => u.id === id) ?? null);
  }
  findByEmail(email: Email): Promise<User | null> {
    return Promise.resolve(this.rows.find((u) => u.email.equals(email)) ?? null);
  }
  create(input: ICreateUserInput): Promise<User> {
    const now = new Date();
    const user = new User({
      id: `u${++this.seq}`,
      email: input.email,
      role: input.role ?? User.DEFAULT_ROLE,
      createdAt: now,
      updatedAt: now,
    });
    this.rows.push(user);
    return Promise.resolve(user);
  }
}

class InMemoryOAuthAccountRepository extends OAuthAccountRepository {
  readonly rows: OAuthAccount[] = [];
  private seq = 0;

  findByProviderAccount(provider: Provider, providerUserId: string): Promise<OAuthAccount | null> {
    return Promise.resolve(
      this.rows.find((a) => a.provider.equals(provider) && a.providerUserId === providerUserId) ??
        null,
    );
  }
  create(input: ICreateOAuthAccountInput): Promise<OAuthAccount> {
    const account = new OAuthAccount({
      id: `a${++this.seq}`,
      provider: input.provider,
      providerUserId: input.providerUserId,
      userId: input.userId,
      createdAt: new Date(),
    });
    this.rows.push(account);
    return Promise.resolve(account);
  }
}

class InMemoryRefreshTokenRepository extends RefreshTokenRepository {
  readonly rows: IRefreshTokenRecord[] = [];
  private seq = 0;

  create(input: ICreateRefreshTokenInput): Promise<IRefreshTokenRecord> {
    const record: IRefreshTokenRecord = {
      id: `r${++this.seq}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.rows.push(record);
    return Promise.resolve(record);
  }
  findByTokenHash(tokenHash: string): Promise<IRefreshTokenRecord | null> {
    return Promise.resolve(this.rows.find((r) => r.tokenHash === tokenHash) ?? null);
  }
  revoke(): Promise<void> {
    return Promise.resolve();
  }
  revokeAllForUser(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeProvider implements IOAuthProvider {
  failExchange = false;
  constructor(
    readonly name: IProviderName,
    private readonly profile: IOAuthProfile,
  ) {}
  authorizeUrl(_params: IAuthorizeUrlParams): string {
    return "https://example.test/authorize";
  }
  exchangeCode(): Promise<IOAuthTokens> {
    return this.failExchange
      ? Promise.reject(new Error("invalid_grant"))
      : Promise.resolve({ accessToken: "provider-access" });
  }
  fetchProfile(): Promise<IOAuthProfile> {
    return Promise.resolve(this.profile);
  }
}

class FakeTokenService implements ITokenService {
  issuePair(input: IIssueTokensInput): Promise<IIssuedTokens> {
    return Promise.resolve({
      accessToken: `access:${input.userId}`,
      refreshToken: `refresh:${input.userId}`,
      refreshTokenHash: `rhash:${input.userId}`,
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }
  verifyAccess(): ICurrentUser {
    return { id: "u1", role: "member" };
  }
  verifyRefresh(): IRefreshTokenClaims {
    return { userId: "u1", tokenHash: "rhash:u1" };
  }
}

function makeContext(profile: IOAuthProfile, providerName: IProviderName = "google") {
  const userRepo = new InMemoryUserRepository();
  const accountRepo = new InMemoryOAuthAccountRepository();
  const tokenRepo = new InMemoryRefreshTokenRepository();
  const stateService = new StateService({ secret: "state-secret" });
  const provider = new FakeProvider(providerName, profile);
  const providers = { google: provider, discord: provider } as Record<
    IProviderName,
    IOAuthProvider
  >;
  const useCase = new HandleOAuthCallback(
    providers,
    stateService,
    userRepo,
    accountRepo,
    tokenRepo,
    new FakeTokenService(),
  );
  const state = stateService.issue();
  const base = { code: "auth-code", state, cookieState: state, redirectUri: REDIRECT } as const;
  return { useCase, userRepo, accountRepo, tokenRepo, provider, state, base, providerName };
}

const verifiedProfile = (over: Partial<IOAuthProfile> = {}): IOAuthProfile => ({
  provider: "google",
  providerUserId: "sub-1",
  email: "user@example.com",
  emailVerified: true,
  ...over,
});

describe("HandleOAuthCallback (AC3 first login)", () => {
  it("creates a member User + OAuthAccount, issues + persists a session", async () => {
    const ctx = makeContext(verifiedProfile());
    const result = await ctx.useCase.execute({ provider: "google", ...ctx.base });

    expect(ctx.userRepo.rows).toHaveLength(1);
    expect(ctx.userRepo.rows[0]?.role).toBe("member");
    expect(ctx.userRepo.rows[0]?.email.value).toBe("user@example.com");
    expect(ctx.accountRepo.rows).toHaveLength(1);
    expect(ctx.accountRepo.rows[0]?.provider.value).toBe("google");

    expect(result.user).toEqual({ id: ctx.userRepo.rows[0]?.id, role: "member" });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    // refresh token persisted as a hash (security)
    expect(ctx.tokenRepo.rows).toHaveLength(1);
    expect(ctx.tokenRepo.rows[0]?.tokenHash).toBe(`rhash:${ctx.userRepo.rows[0]?.id}`);
  });
});

describe("HandleOAuthCallback (AC4 linking + returning login)", () => {
  it("links a new provider to an existing User matched by verified email (no duplicate User)", async () => {
    // Existing user has a Google account; now they log in with Discord, same email.
    const ctx = makeContext(
      verifiedProfile({ provider: "discord", providerUserId: "d-1" }),
      "discord",
    );
    const existing = await ctx.userRepo.create({ email: Email.create("user@example.com") });
    await ctx.accountRepo.create({
      provider: Provider.create("google"),
      providerUserId: "g-1",
      userId: existing.id,
    });

    const result = await ctx.useCase.execute({ provider: "discord", ...ctx.base });

    expect(ctx.userRepo.rows).toHaveLength(1); // no duplicate User
    expect(result.user.id).toBe(existing.id);
    const discordAccount = await ctx.accountRepo.findByProviderAccount(
      Provider.create("discord"),
      "d-1",
    );
    expect(discordAccount?.userId).toBe(existing.id);
  });

  it("returns the same User for a returning same-provider login (no new account)", async () => {
    const ctx = makeContext(verifiedProfile({ providerUserId: "sub-1" }));
    const existing = await ctx.userRepo.create({ email: Email.create("user@example.com") });
    await ctx.accountRepo.create({
      provider: Provider.create("google"),
      providerUserId: "sub-1",
      userId: existing.id,
    });

    const result = await ctx.useCase.execute({ provider: "google", ...ctx.base });

    expect(result.user.id).toBe(existing.id);
    expect(ctx.userRepo.rows).toHaveLength(1);
    expect(ctx.accountRepo.rows).toHaveLength(1); // no extra account created
  });
});

describe("HandleOAuthCallback (AC5 failures => no session)", () => {
  it("rejects an invalid state (CSRF) without creating anything", async () => {
    const ctx = makeContext(verifiedProfile());
    const otherState = new StateService({ secret: "state-secret" }).issue();
    await expect(
      ctx.useCase.execute({ provider: "google", ...ctx.base, cookieState: otherState }),
    ).rejects.toBeInstanceOf(OAuthCallbackError);
    expect(ctx.userRepo.rows).toHaveLength(0);
    expect(ctx.tokenRepo.rows).toHaveLength(0);
  });

  it("rejects an invalid/expired code", async () => {
    const ctx = makeContext(verifiedProfile());
    ctx.provider.failExchange = true;
    await expect(ctx.useCase.execute({ provider: "google", ...ctx.base })).rejects.toThrow(
      /code exchange failed/,
    );
    expect(ctx.userRepo.rows).toHaveLength(0);
  });

  it("rejects an unverified email (linking gate)", async () => {
    const ctx = makeContext(verifiedProfile({ emailVerified: false }));
    await expect(ctx.useCase.execute({ provider: "google", ...ctx.base })).rejects.toThrow(
      /unverified/,
    );
    expect(ctx.userRepo.rows).toHaveLength(0);
    expect(ctx.tokenRepo.rows).toHaveLength(0);
  });
});

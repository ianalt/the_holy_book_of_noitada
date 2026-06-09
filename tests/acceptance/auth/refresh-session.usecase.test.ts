// Task T-010: RefreshSession use case. Covers AC8: a valid refresh issues a new
// access token and rotates the refresh token (old row revoked, new row persisted);
// an invalid/expired/revoked/missing token yields a RefreshSessionError (=> 401).
import { beforeEach, describe, expect, it } from "vitest";
import {
  RefreshSession,
  RefreshSessionError,
} from "../../../apps/api/src/modules/auth/application/refresh-session.usecase";
import { User } from "../../../apps/api/src/modules/auth/domain/entities/user.entity";
import type {
  IIssueTokensInput,
  IIssuedTokens,
  IRefreshTokenClaims,
  ITokenService,
} from "../../../apps/api/src/modules/auth/domain/ports/token-service.port";
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
import { Email } from "../../../apps/api/src/modules/auth/domain/value-objects/email.vo";

const future = (): Date => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
  revoke(id: string): Promise<void> {
    const record = this.rows.find((r) => r.id === id);
    if (record) record.revokedAt = new Date();
    return Promise.resolve();
  }
  revokeAllForUser(userId: string): Promise<void> {
    for (const r of this.rows) {
      if (r.userId === userId) r.revokedAt = new Date();
    }
    return Promise.resolve();
  }
}

// Deterministic token service: a refresh token `refresh:<user>:<n>` maps to hash
// `rhash:<user>:<n>`; each issue increments <n> so rotation yields a distinct pair.
class FakeTokenService implements ITokenService {
  private seq = 0;
  issuePair(input: IIssueTokensInput): Promise<IIssuedTokens> {
    const n = ++this.seq;
    return Promise.resolve({
      accessToken: `access:${input.userId}:${n}`,
      refreshToken: `refresh:${input.userId}:${n}`,
      refreshTokenHash: `rhash:${input.userId}:${n}`,
      refreshTokenExpiresAt: future(),
    });
  }
  verifyAccess(): ICurrentUser {
    return { id: "u1", role: "member" };
  }
  verifyRefresh(token: string): IRefreshTokenClaims {
    const match = /^refresh:([^:]+):(\d+)$/.exec(token);
    if (!match) throw new Error("invalid refresh token");
    return { userId: match[1] as string, tokenHash: `rhash:${match[1]}:${match[2]}` };
  }
}

let userRepo: InMemoryUserRepository;
let tokenRepo: InMemoryRefreshTokenRepository;
let tokenService: FakeTokenService;
let useCase: RefreshSession;

beforeEach(() => {
  userRepo = new InMemoryUserRepository();
  tokenRepo = new InMemoryRefreshTokenRepository();
  tokenService = new FakeTokenService();
  useCase = new RefreshSession(tokenService, tokenRepo, userRepo);
});

async function seedActiveSession() {
  const user = await userRepo.create({ email: Email.create("u@example.com") });
  const issued = await tokenService.issuePair({ userId: user.id, role: user.role });
  await tokenRepo.create({
    userId: user.id,
    tokenHash: issued.refreshTokenHash,
    expiresAt: issued.refreshTokenExpiresAt,
  });
  return { user, issued };
}

describe("RefreshSession (AC8 valid refresh)", () => {
  it("issues a new access token and rotates the refresh token", async () => {
    const { issued } = await seedActiveSession();

    const result = await useCase.execute({ refreshToken: issued.refreshToken });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(issued.refreshToken); // rotated

    // old row revoked, new row active
    const oldRow = tokenRepo.rows.find((r) => r.tokenHash === issued.refreshTokenHash);
    expect(oldRow?.revokedAt).toBeInstanceOf(Date);

    const newHash = tokenService.verifyRefresh(result.refreshToken).tokenHash;
    const newRow = tokenRepo.rows.find((r) => r.tokenHash === newHash);
    expect(newRow?.revokedAt).toBeNull();
    expect(tokenRepo.rows).toHaveLength(2);
  });
});

describe("RefreshSession (AC8 rejections => 401)", () => {
  it("rejects a malformed/invalid refresh token", async () => {
    await expect(useCase.execute({ refreshToken: "not-a-token" })).rejects.toBeInstanceOf(
      RefreshSessionError,
    );
  });

  it("rejects a token with no stored record", async () => {
    const { issued } = await seedActiveSession();
    // remove the record so the hash has no match
    tokenRepo.rows.length = 0;
    await expect(useCase.execute({ refreshToken: issued.refreshToken })).rejects.toThrow(
      /not active/,
    );
  });

  it("rejects a reused (already revoked/rotated) token", async () => {
    const { issued } = await seedActiveSession();
    const row = tokenRepo.rows[0];
    if (row) await tokenRepo.revoke(row.id);
    await expect(useCase.execute({ refreshToken: issued.refreshToken })).rejects.toThrow(
      /not active/,
    );
  });

  it("rejects an expired stored record", async () => {
    const user = await userRepo.create({ email: Email.create("exp@example.com") });
    const issued = await tokenService.issuePair({ userId: user.id, role: user.role });
    await tokenRepo.create({
      userId: user.id,
      tokenHash: issued.refreshTokenHash,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(useCase.execute({ refreshToken: issued.refreshToken })).rejects.toThrow(
      /not active/,
    );
  });

  it("rejects when the user no longer exists", async () => {
    const issued = await tokenService.issuePair({ userId: "ghost", role: "member" });
    await tokenRepo.create({
      userId: "ghost",
      tokenHash: issued.refreshTokenHash,
      expiresAt: future(),
    });
    await expect(useCase.execute({ refreshToken: issued.refreshToken })).rejects.toThrow(
      /User not found/,
    );
  });
});

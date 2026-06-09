// Task T-011: Logout use case. Covers AC9: revokes the presented refresh token's
// stored row, idempotently (missing / invalid / unknown / already-revoked tokens
// resolve without error). Cookie clearing itself is the controller's job (T-013).
import { beforeEach, describe, expect, it } from "vitest";
import { Logout } from "../../../apps/api/src/modules/auth/application/logout.usecase";
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
import type { ICurrentUser } from "../../../apps/api/src/modules/auth/domain/types/current-user.type";

const future = (): Date => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

// A token `valid:<user>` maps to hash `hash:<user>`; anything else is invalid.
class FakeTokenService implements ITokenService {
  issuePair(input: IIssueTokensInput): Promise<IIssuedTokens> {
    return Promise.resolve({
      accessToken: `access:${input.userId}`,
      refreshToken: `valid:${input.userId}`,
      refreshTokenHash: `hash:${input.userId}`,
      refreshTokenExpiresAt: future(),
    });
  }
  verifyAccess(): ICurrentUser {
    return { id: "u1", role: "member" };
  }
  verifyRefresh(token: string): IRefreshTokenClaims {
    if (!token.startsWith("valid:")) throw new Error("invalid refresh token");
    const userId = token.slice("valid:".length);
    return { userId, tokenHash: `hash:${userId}` };
  }
}

let tokenRepo: InMemoryRefreshTokenRepository;
let useCase: Logout;

beforeEach(() => {
  tokenRepo = new InMemoryRefreshTokenRepository();
  useCase = new Logout(new FakeTokenService(), tokenRepo);
});

describe("Logout (AC9)", () => {
  it("revokes the presented refresh token's row", async () => {
    await tokenRepo.create({ userId: "u1", tokenHash: "hash:u1", expiresAt: future() });

    await useCase.execute({ refreshToken: "valid:u1" });

    expect(tokenRepo.rows[0]?.revokedAt).toBeInstanceOf(Date);
  });

  it("is idempotent: a second logout with the same token does not throw", async () => {
    await tokenRepo.create({ userId: "u1", tokenHash: "hash:u1", expiresAt: future() });

    await useCase.execute({ refreshToken: "valid:u1" });
    await expect(useCase.execute({ refreshToken: "valid:u1" })).resolves.toBeUndefined();
    expect(tokenRepo.rows[0]?.revokedAt).toBeInstanceOf(Date);
  });

  it("resolves without error when no refresh token is present", async () => {
    await expect(useCase.execute({})).resolves.toBeUndefined();
  });

  it("resolves without error for an invalid token", async () => {
    await expect(useCase.execute({ refreshToken: "garbage" })).resolves.toBeUndefined();
  });

  it("resolves without error when no stored record matches", async () => {
    await expect(useCase.execute({ refreshToken: "valid:u1" })).resolves.toBeUndefined();
  });
});

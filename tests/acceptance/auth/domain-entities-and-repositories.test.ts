// Task T-003: domain entities + abstract repository contracts. Entities are real
// production code; the repository contracts are exercised here via in-memory fakes
// to prove the interfaces support the AC3/AC4/AC8/AC9 flows (the Prisma impls land
// in T-006, the use-case behaviour in T-009..T-011).
import { beforeEach, describe, expect, it } from "vitest";
import { OAuthAccount } from "../../../apps/api/src/modules/auth/domain/entities/o-auth-account.entity";
import { User } from "../../../apps/api/src/modules/auth/domain/entities/user.entity";
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
import { Email } from "../../../apps/api/src/modules/auth/domain/value-objects/email.vo";
import { Provider } from "../../../apps/api/src/modules/auth/domain/value-objects/provider.vo";

class InMemoryUserRepository extends UserRepository {
  private readonly users: User[] = [];
  private seq = 0;

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }

  findByEmail(email: Email): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.email.equals(email)) ?? null);
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
    this.users.push(user);
    return Promise.resolve(user);
  }
}

class InMemoryOAuthAccountRepository extends OAuthAccountRepository {
  private readonly accounts: OAuthAccount[] = [];
  private seq = 0;

  findByProviderAccount(provider: Provider, providerUserId: string): Promise<OAuthAccount | null> {
    return Promise.resolve(
      this.accounts.find(
        (a) => a.provider.equals(provider) && a.providerUserId === providerUserId,
      ) ?? null,
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
    this.accounts.push(account);
    return Promise.resolve(account);
  }
}

class InMemoryRefreshTokenRepository extends RefreshTokenRepository {
  private readonly records: IRefreshTokenRecord[] = [];
  private seq = 0;

  create(input: ICreateRefreshTokenInput): Promise<IRefreshTokenRecord> {
    const record: IRefreshTokenRecord = {
      id: `r${++this.seq}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.records.push(record);
    return Promise.resolve(record);
  }

  findByTokenHash(tokenHash: string): Promise<IRefreshTokenRecord | null> {
    return Promise.resolve(this.records.find((r) => r.tokenHash === tokenHash) ?? null);
  }

  revoke(id: string): Promise<void> {
    const record = this.records.find((r) => r.id === id);
    if (record) record.revokedAt = new Date();
    return Promise.resolve();
  }

  revokeAllForUser(userId: string): Promise<void> {
    for (const r of this.records) {
      if (r.userId === userId) r.revokedAt = new Date();
    }
    return Promise.resolve();
  }
}

describe("User entity (AC3, AC4)", () => {
  it("exposes 'member' as the default role (AC3)", () => {
    expect(User.DEFAULT_ROLE).toBe("member");
  });

  it("holds a verified Email as its identity key (AC4)", () => {
    const user = new User({
      id: "u1",
      email: Email.create("user@example.com"),
      role: "member",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(user.email.value).toBe("user@example.com");
    expect(user.role).toBe("member");
  });
});

describe("OAuthAccount entity (AC3, AC4)", () => {
  it("links a provider identity to a User", () => {
    const account = new OAuthAccount({
      id: "a1",
      provider: Provider.create("google"),
      providerUserId: "sub-123",
      userId: "u1",
      createdAt: new Date(),
    });
    expect(account.provider.value).toBe("google");
    expect(account.providerUserId).toBe("sub-123");
    expect(account.userId).toBe("u1");
  });
});

describe("UserRepository contract", () => {
  let users: InMemoryUserRepository;

  beforeEach(() => {
    users = new InMemoryUserRepository();
  });

  it("create() defaults a new user to the member role (AC3)", async () => {
    const user = await users.create({ email: Email.create("new@example.com") });
    expect(user.role).toBe("member");
    expect(user.id).toBeTruthy();
  });

  it("findByEmail() resolves an existing user for cross-provider linking (AC4)", async () => {
    const created = await users.create({ email: Email.create("link@example.com") });
    const found = await users.findByEmail(Email.create("LINK@example.com"));
    expect(found?.id).toBe(created.id);
  });
});

describe("OAuthAccountRepository contract (AC3, AC4)", () => {
  it("detects a returning same-provider login via findByProviderAccount", async () => {
    const accounts = new InMemoryOAuthAccountRepository();
    const google = Provider.create("google");
    expect(await accounts.findByProviderAccount(google, "sub-1")).toBeNull();

    await accounts.create({ provider: google, providerUserId: "sub-1", userId: "u1" });
    const found = await accounts.findByProviderAccount(google, "sub-1");
    expect(found?.userId).toBe("u1");
  });

  it("links a second provider to the same user (AC4)", async () => {
    const accounts = new InMemoryOAuthAccountRepository();
    await accounts.create({
      provider: Provider.create("google"),
      providerUserId: "g-1",
      userId: "u1",
    });
    const discord = await accounts.create({
      provider: Provider.create("discord"),
      providerUserId: "d-1",
      userId: "u1",
    });
    expect(discord.userId).toBe("u1");
    expect(discord.provider.value).toBe("discord");
  });
});

describe("RefreshTokenRepository contract (AC8, AC9)", () => {
  it("supports rotation: create, find by hash, revoke (AC8)", async () => {
    const tokens = new InMemoryRefreshTokenRepository();
    const created = await tokens.create({
      userId: "u1",
      tokenHash: "hash-1",
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    expect(created.revokedAt).toBeNull();

    const found = await tokens.findByTokenHash("hash-1");
    expect(found?.id).toBe(created.id);

    await tokens.revoke(created.id);
    const afterRevoke = await tokens.findByTokenHash("hash-1");
    expect(afterRevoke?.revokedAt).toBeInstanceOf(Date);
  });

  it("revokes all tokens for a user on logout (AC9)", async () => {
    const tokens = new InMemoryRefreshTokenRepository();
    await tokens.create({ userId: "u1", tokenHash: "h1", expiresAt: new Date() });
    await tokens.create({ userId: "u1", tokenHash: "h2", expiresAt: new Date() });

    await tokens.revokeAllForUser("u1");
    expect((await tokens.findByTokenHash("h1"))?.revokedAt).toBeInstanceOf(Date);
    expect((await tokens.findByTokenHash("h2"))?.revokedAt).toBeInstanceOf(Date);
  });
});

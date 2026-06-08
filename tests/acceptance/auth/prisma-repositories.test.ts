// Task T-006: Prisma repository implementations. Integration test against the
// live database (apps/api/.env -> DATABASE_URL) using the Prisma 7 pg driver
// adapter. Covers AC3 (create member + link account), AC4 (find by email, link a
// second provider, no duplicate User / provider identity), AC8 and AC9 (refresh
// token create/find/revoke). NOTE: cleans the auth tables before each test, so it
// expects a dedicated/dev database.
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Email } from "../../../apps/api/src/modules/auth/domain/value-objects/email.vo";
import { Provider } from "../../../apps/api/src/modules/auth/domain/value-objects/provider.vo";
import { PrismaOAuthAccountRepository } from "../../../apps/api/src/modules/auth/infrastructure/persistence/prisma-o-auth-account.repository";
import { PrismaRefreshTokenRepository } from "../../../apps/api/src/modules/auth/infrastructure/persistence/prisma-refresh-token.repository";
import { PrismaUserRepository } from "../../../apps/api/src/modules/auth/infrastructure/persistence/prisma-user.repository";

dotenv.config({ path: resolve(__dirname, "../../../apps/api/.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set (apps/api/.env) to run repository integration tests");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const users = new PrismaUserRepository(prisma);
const accounts = new PrismaOAuthAccountRepository(prisma);
const tokens = new PrismaRefreshTokenRepository(prisma);

const inAWeek = (): Date => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("PrismaUserRepository (AC3, AC4)", () => {
  it("AC3: create() materializes a new user with the default member role", async () => {
    const user = await users.create({ email: Email.create("new@example.com") });
    expect(user.id).toBeTruthy();
    expect(user.role).toBe("member");
    expect(user.email.value).toBe("new@example.com");
  });

  it("AC4: findByEmail resolves an existing user for linking (normalized)", async () => {
    const created = await users.create({ email: Email.create("link@example.com") });
    const found = await users.findByEmail(Email.create("LINK@Example.com"));
    expect(found?.id).toBe(created.id);
  });

  it("AC4: a duplicate email is rejected by the unique constraint (no duplicate User)", async () => {
    await users.create({ email: Email.create("dup@example.com") });
    await expect(users.create({ email: Email.create("dup@example.com") })).rejects.toThrow();
  });
});

describe("PrismaOAuthAccountRepository (AC3, AC4)", () => {
  it("AC3: links a provider identity to a user on first login", async () => {
    const user = await users.create({ email: Email.create("first@example.com") });
    const account = await accounts.create({
      provider: Provider.create("google"),
      providerUserId: "sub-1",
      userId: user.id,
    });
    expect(account.userId).toBe(user.id);
    expect(account.provider.value).toBe("google");
  });

  it("AC4: a second provider links to the same user; both resolve back to it", async () => {
    const user = await users.create({ email: Email.create("multi@example.com") });
    await accounts.create({
      provider: Provider.create("google"),
      providerUserId: "g-1",
      userId: user.id,
    });
    await accounts.create({
      provider: Provider.create("discord"),
      providerUserId: "d-1",
      userId: user.id,
    });

    const viaGoogle = await accounts.findByProviderAccount(Provider.create("google"), "g-1");
    const viaDiscord = await accounts.findByProviderAccount(Provider.create("discord"), "d-1");
    expect(viaGoogle?.userId).toBe(user.id);
    expect(viaDiscord?.userId).toBe(user.id);
  });

  it("returning login: findByProviderAccount resolves the linked account, null otherwise", async () => {
    const user = await users.create({ email: Email.create("ret@example.com") });
    await accounts.create({
      provider: Provider.create("discord"),
      providerUserId: "d-9",
      userId: user.id,
    });
    expect((await accounts.findByProviderAccount(Provider.create("discord"), "d-9"))?.userId).toBe(
      user.id,
    );
    expect(await accounts.findByProviderAccount(Provider.create("discord"), "missing")).toBeNull();
  });

  it("AC3/AC4: a duplicate (provider, providerUserId) is rejected", async () => {
    const user = await users.create({ email: Email.create("uniq@example.com") });
    await accounts.create({
      provider: Provider.create("google"),
      providerUserId: "sub-x",
      userId: user.id,
    });
    await expect(
      accounts.create({
        provider: Provider.create("google"),
        providerUserId: "sub-x",
        userId: user.id,
      }),
    ).rejects.toThrow();
  });
});

describe("PrismaRefreshTokenRepository (AC8, AC9)", () => {
  it("AC8: create, find by hash, then revoke a refresh token", async () => {
    const user = await users.create({ email: Email.create("rt@example.com") });
    const created = await tokens.create({
      userId: user.id,
      tokenHash: "hash-1",
      expiresAt: inAWeek(),
    });
    expect(created.revokedAt).toBeNull();

    const found = await tokens.findByTokenHash("hash-1");
    expect(found?.id).toBe(created.id);

    await tokens.revoke(created.id);
    expect((await tokens.findByTokenHash("hash-1"))?.revokedAt).toBeInstanceOf(Date);
  });

  it("AC9: revokeAllForUser revokes every active token for the user", async () => {
    const user = await users.create({ email: Email.create("logout@example.com") });
    await tokens.create({ userId: user.id, tokenHash: "h1", expiresAt: inAWeek() });
    await tokens.create({ userId: user.id, tokenHash: "h2", expiresAt: inAWeek() });

    await tokens.revokeAllForUser(user.id);
    expect((await tokens.findByTokenHash("h1"))?.revokedAt).toBeInstanceOf(Date);
    expect((await tokens.findByTokenHash("h2"))?.revokedAt).toBeInstanceOf(Date);
  });
});

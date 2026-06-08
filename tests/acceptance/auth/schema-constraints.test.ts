// Task T-001 acceptance: the Prisma schema must declare the constraints that the
// auth acceptance criteria depend on. Behavioural ACs (full flows) are covered by
// later use-case tasks; here we verify the data-model contribution to each AC.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(__dirname, "../../../apps/api/prisma/schema.prisma"), "utf8");

// Collapse whitespace so attribute order/spacing does not matter.
const flat = schema.replace(/\s+/g, " ");

describe("auth schema constraints (T-001)", () => {
  it("AC3: User has a default role of 'member'", () => {
    expect(flat).toMatch(/role\s+String\s+@default\("member"\)/);
  });

  it("AC4: User.email is unique (identity key for cross-provider linking)", () => {
    expect(flat).toMatch(/email\s+String\s+@unique/);
  });

  it("AC3/AC4: OAuthAccount is unique per (provider, providerUserId)", () => {
    expect(flat).toContain("@@unique([provider, providerUserId])");
  });

  it("AC4: OAuthAccount belongs to a User (1 User : N OAuthAccounts)", () => {
    expect(flat).toMatch(/model OAuthAccount \{[^}]*userId\s+String/);
    expect(flat).toMatch(/accounts\s+OAuthAccount\[\]/);
  });

  it("AC8/AC9: RefreshToken stores a unique hash and a revocation timestamp", () => {
    expect(flat).toMatch(/tokenHash\s+String\s+@unique/);
    expect(flat).toMatch(/revokedAt\s+DateTime\?/);
  });

  it("AC8: RefreshToken carries an expiry (refresh TTL)", () => {
    expect(flat).toMatch(/expiresAt\s+DateTime/);
  });
});

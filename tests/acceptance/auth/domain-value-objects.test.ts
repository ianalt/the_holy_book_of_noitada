// Task T-002: domain value objects + shared types. Verifies the AC-mapped
// constraints this task contributes; full flow behaviour lands with the use cases.
import { describe, expect, expectTypeOf, it } from "vitest";
import type { IOAuthProfile } from "../../../apps/api/src/modules/auth/domain/types/o-auth-profile.type";
import { Email } from "../../../apps/api/src/modules/auth/domain/value-objects/email.vo";
import { Provider } from "../../../apps/api/src/modules/auth/domain/value-objects/provider.vo";

describe("Provider value object (AC1, AC2)", () => {
  it("accepts the supported providers", () => {
    expect(Provider.create("google").value).toBe("google");
    expect(Provider.create("discord").value).toBe("discord");
  });

  it("rejects any other provider", () => {
    expect(() => Provider.create("facebook")).toThrow(/Unsupported OAuth provider/);
    expect(() => Provider.create("")).toThrow(/Unsupported OAuth provider/);
  });

  it("exposes a type guard for the supported set", () => {
    expect(Provider.isSupported("google")).toBe(true);
    expect(Provider.isSupported("twitter")).toBe(false);
  });

  it("compares by value", () => {
    expect(Provider.create("google").equals(Provider.create("google"))).toBe(true);
    expect(Provider.create("google").equals(Provider.create("discord"))).toBe(false);
  });
});

describe("Email value object (AC4 identity key)", () => {
  it("normalizes to trimmed, lower-cased form for stable linking", () => {
    expect(Email.create("  USER@Example.COM  ").value).toBe("user@example.com");
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["", "user", "user@", "@example.com", "user@example"]) {
      expect(() => Email.create(bad)).toThrow(/Invalid email address/);
    }
  });

  it("compares case-insensitively via normalization", () => {
    expect(Email.create("A@B.com").equals(Email.create("a@b.com"))).toBe(true);
  });
});

describe("IOAuthProfile (AC4 verified-email gate)", () => {
  it("carries the emailVerified flag the linking decision depends on", () => {
    const profile: IOAuthProfile = {
      provider: "discord",
      providerUserId: "abc123",
      email: "user@example.com",
      emailVerified: true,
    };
    expect(profile.emailVerified).toBe(true);
    expectTypeOf<IOAuthProfile>().toHaveProperty("emailVerified").toEqualTypeOf<boolean>();
  });
});

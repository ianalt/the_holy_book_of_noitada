// Task T-008: StartOAuth use case. Covers AC1 (Google) and AC2 (Discord): the
// produced authorize URL targets the right provider, carries the backend redirect
// URI and a fresh signed state, and the returned state is what the controller will
// store as a cookie. Wired with the real providers + StateService.
import { describe, expect, it } from "vitest";
import { StartOAuth } from "../../../apps/api/src/modules/auth/application/start-oauth.usecase";
import type { IProviderName } from "../../../apps/api/src/modules/auth/domain/value-objects/provider.vo";
import { DiscordProvider } from "../../../apps/api/src/modules/auth/infrastructure/providers/discord.provider";
import { GoogleProvider } from "../../../apps/api/src/modules/auth/infrastructure/providers/google.provider";
import { StateService } from "../../../apps/api/src/modules/auth/infrastructure/providers/state";

const GOOGLE_REDIRECT = "http://localhost:3001/auth/google/callback";
const DISCORD_REDIRECT = "http://localhost:3001/auth/discord/callback";

function buildUseCase() {
  const stateService = new StateService({ secret: "state-secret" });
  const providers = {
    google: new GoogleProvider({ clientId: "gid", clientSecret: "gsecret" }),
    discord: new DiscordProvider({ clientId: "did", clientSecret: "dsecret" }),
  };
  return { useCase: new StartOAuth(providers, stateService), stateService };
}

describe("StartOAuth (AC1, AC2)", () => {
  it("AC1: builds the Google authorize URL with the backend redirect URI + state", () => {
    const { useCase, stateService } = buildUseCase();
    const result = useCase.execute({ provider: "google", redirectUri: GOOGLE_REDIRECT });

    const url = new URL(result.authorizeUrl);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe(GOOGLE_REDIRECT);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe(result.state);
    // the returned state is the signed value the controller will set as a cookie
    expect(stateService.validate(result.state, result.state)).toBe(true);
  });

  it("AC2: builds the Discord authorize URL with the backend redirect URI + state", () => {
    const { useCase, stateService } = buildUseCase();
    const result = useCase.execute({ provider: "discord", redirectUri: DISCORD_REDIRECT });

    const url = new URL(result.authorizeUrl);
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(DISCORD_REDIRECT);
    expect(url.searchParams.get("state")).toBe(result.state);
    expect(stateService.validate(result.state, result.state)).toBe(true);
  });

  it("mints a fresh state on every call", () => {
    const { useCase } = buildUseCase();
    const a = useCase.execute({ provider: "google", redirectUri: GOOGLE_REDIRECT });
    const b = useCase.execute({ provider: "google", redirectUri: GOOGLE_REDIRECT });
    expect(a.state).not.toBe(b.state);
  });

  it("rejects an unknown provider (controller maps to 404)", () => {
    const { useCase } = buildUseCase();
    expect(() =>
      useCase.execute({ provider: "facebook" as IProviderName, redirectUri: GOOGLE_REDIRECT }),
    ).toThrow(/Unsupported provider/);
  });
});

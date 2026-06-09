// Task T-013: AuthController routes + AuthModule wiring. Covers the HTTP behaviour
// the controller adds on top of the use cases: AC1/AC2 (start redirects to the
// provider + sets the state cookie), AC3/AC4 (callback sets access+refresh cookies
// and redirects home), AC5 (callback failure => redirect to login-error, no
// session), AC8 (refresh sets new cookies / 401), AC9 (logout clears cookies, 200).
// The controller is instantiated directly with fake use cases + a recording
// response; underlying behaviour is covered by T-008..T-012.
import "reflect-metadata";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthCallbackError } from "../../../apps/api/src/modules/auth/application/handle-oauth-callback.usecase";
import type { HandleOAuthCallback } from "../../../apps/api/src/modules/auth/application/handle-oauth-callback.usecase";
import type { Logout } from "../../../apps/api/src/modules/auth/application/logout.usecase";
import type { RefreshSession } from "../../../apps/api/src/modules/auth/application/refresh-session.usecase";
import type { StartOAuth } from "../../../apps/api/src/modules/auth/application/start-oauth.usecase";
import { AuthModule } from "../../../apps/api/src/modules/auth/auth.module";
import {
  AuthController,
  type IAuthControllerConfig,
  type IAuthRequest,
  type IAuthResponse,
} from "../../../apps/api/src/modules/auth/presentation/auth.controller";

const config: IAuthControllerConfig = {
  callbackBaseUrl: "http://localhost:3001",
  frontendUrl: "http://localhost:5173",
  cookieSecure: true,
};

function makeResponse() {
  const state = {
    headers: {} as Record<string, string | string[]>,
    statusCode: 200,
    redirectedTo: undefined as string | undefined,
    body: undefined as unknown,
  };
  const res: IAuthResponse = {
    setHeader(name, value) {
      state.headers[name] = value;
    },
    redirect(url) {
      state.redirectedTo = url;
      state.statusCode = 302;
    },
    status(code) {
      state.statusCode = code;
      return res;
    },
    json(body) {
      state.body = body;
    },
  };
  return { res, state };
}

function setCookies(state: { headers: Record<string, string | string[]> }): string[] {
  const value = state.headers["Set-Cookie"];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function findCookie(
  state: { headers: Record<string, string | string[]> },
  name: string,
): string | undefined {
  return setCookies(state).find((c) => c.startsWith(`${name}=`));
}

const startExecute = vi.fn();
const callbackExecute = vi.fn();
const refreshExecute = vi.fn();
const logoutExecute = vi.fn();

let controller: AuthController;

beforeEach(() => {
  startExecute.mockReset();
  callbackExecute.mockReset();
  refreshExecute.mockReset();
  logoutExecute.mockReset();
  controller = new AuthController(
    { execute: startExecute } as unknown as StartOAuth,
    { execute: callbackExecute } as unknown as HandleOAuthCallback,
    { execute: refreshExecute } as unknown as RefreshSession,
    { execute: logoutExecute } as unknown as Logout,
    config,
  );
});

describe("GET /auth/:provider/start (AC1, AC2)", () => {
  it("redirects to the provider and sets the state cookie", () => {
    startExecute.mockReturnValue({ authorizeUrl: "https://provider/auth?x=1", state: "STATE123" });
    const { res, state } = makeResponse();

    controller.start("google", res);

    expect(startExecute).toHaveBeenCalledWith({
      provider: "google",
      redirectUri: "http://localhost:3001/auth/google/callback",
    });
    expect(state.redirectedTo).toBe("https://provider/auth?x=1");
    const cookie = findCookie(state, "oauth_state");
    expect(cookie).toContain("oauth_state=STATE123");
    expect(cookie).toContain("HttpOnly");
  });

  it("works for discord too", () => {
    startExecute.mockReturnValue({ authorizeUrl: "https://discord/auth", state: "S" });
    const { res, state } = makeResponse();
    controller.start("discord", res);
    expect(startExecute).toHaveBeenCalledWith({
      provider: "discord",
      redirectUri: "http://localhost:3001/auth/discord/callback",
    });
    expect(state.redirectedTo).toBe("https://discord/auth");
  });

  it("returns 404 for an unknown provider", () => {
    const { res } = makeResponse();
    expect(() => controller.start("facebook", res)).toThrow(NotFoundException);
  });
});

describe("GET /auth/:provider/callback (AC3, AC4, AC5)", () => {
  const req: IAuthRequest = { cookies: { oauth_state: "STATE123" } };

  it("AC3/AC4: sets access+refresh cookies and redirects home on success", async () => {
    callbackExecute.mockResolvedValue({
      accessToken: "ACCESS",
      refreshToken: "REFRESH",
      user: { id: "u1", role: "member" },
    });
    const { res, state } = makeResponse();

    await controller.callback("google", "the-code", "STATE123", req, res);

    expect(callbackExecute).toHaveBeenCalledWith({
      provider: "google",
      code: "the-code",
      state: "STATE123",
      cookieState: "STATE123",
      redirectUri: "http://localhost:3001/auth/google/callback",
    });
    expect(state.redirectedTo).toBe("http://localhost:5173/");
    expect(findCookie(state, "access_token")).toContain("access_token=ACCESS");
    expect(findCookie(state, "refresh_token")).toContain("refresh_token=REFRESH");
    expect(findCookie(state, "oauth_state")).toContain("Max-Age=0"); // single-use cleared
  });

  it("AC5: redirects to login-error and issues no session on failure", async () => {
    callbackExecute.mockRejectedValue(new OAuthCallbackError("bad code"));
    const { res, state } = makeResponse();

    await controller.callback("google", "bad", "STATE123", req, res);

    expect(state.redirectedTo).toBe("http://localhost:5173/login-error");
    expect(findCookie(state, "access_token")).toBeUndefined();
    expect(findCookie(state, "refresh_token")).toBeUndefined();
  });

  it("AC5: redirects to login-error for an unknown provider", async () => {
    const { res, state } = makeResponse();
    await controller.callback("facebook", "c", "s", req, res);
    expect(state.redirectedTo).toBe("http://localhost:5173/login-error");
    expect(callbackExecute).not.toHaveBeenCalled();
  });
});

describe("POST /auth/refresh (AC8)", () => {
  it("rotates cookies and returns 200 on success", async () => {
    refreshExecute.mockResolvedValue({
      accessToken: "NEW_ACCESS",
      refreshToken: "NEW_REFRESH",
      user: { id: "u1", role: "member" },
    });
    const { res, state } = makeResponse();

    await controller.refresh({ cookies: { refresh_token: "OLD" } }, res);

    expect(refreshExecute).toHaveBeenCalledWith({ refreshToken: "OLD" });
    expect(state.statusCode).toBe(200);
    expect(findCookie(state, "access_token")).toContain("access_token=NEW_ACCESS");
    expect(findCookie(state, "refresh_token")).toContain("refresh_token=NEW_REFRESH");
  });

  it("returns 401 on an invalid/expired refresh token", async () => {
    refreshExecute.mockRejectedValue(new Error("invalid"));
    const { res, state } = makeResponse();

    await controller.refresh({ cookies: {} }, res);

    expect(state.statusCode).toBe(401);
    expect(findCookie(state, "access_token")).toBeUndefined();
  });
});

describe("POST /auth/logout (AC9)", () => {
  it("clears both cookies and returns 200", async () => {
    logoutExecute.mockResolvedValue(undefined);
    const { res, state } = makeResponse();

    await controller.doLogout({ cookies: { refresh_token: "RT" } }, res);

    expect(logoutExecute).toHaveBeenCalledWith({ refreshToken: "RT" });
    expect(state.statusCode).toBe(200);
    expect(findCookie(state, "access_token")).toContain("Max-Age=0");
    expect(findCookie(state, "refresh_token")).toContain("Max-Age=0");
  });
});

describe("GET /auth/me", () => {
  it("returns the authenticated principal", () => {
    expect(controller.me({ id: "u1", role: "member" })).toEqual({ id: "u1", role: "member" });
  });
});

describe("AuthModule", () => {
  it("is defined and loads without error", () => {
    expect(AuthModule).toBeDefined();
  });
});

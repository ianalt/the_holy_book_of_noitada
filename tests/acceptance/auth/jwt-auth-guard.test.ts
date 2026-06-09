// Task T-012: JwtAuthGuard + @CurrentUser. Covers AC6 (no/invalid access cookie =>
// 401) and AC7 (valid access cookie passes and exposes the principal). The guard is
// instantiated directly with a real JwtTokenService — no Nest DI container needed.
import "reflect-metadata";
import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { ICurrentUser } from "../../../apps/api/src/modules/auth/domain/types/current-user.type";
import { ACCESS_TOKEN_COOKIE } from "../../../apps/api/src/modules/auth/infrastructure/http/cookie.helper";
import { JwtTokenService } from "../../../apps/api/src/modules/auth/infrastructure/token/jwt-token.service";
import { currentUserFactory } from "../../../apps/api/src/modules/auth/presentation/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../../apps/api/src/modules/auth/presentation/guards/jwt-auth.guard";

const SECRET = "guard-secret";

interface ITestRequest {
  cookies?: Record<string, string>;
  headers?: { cookie?: string };
  user?: ICurrentUser;
}

function contextWith(request: ITestRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard (AC7: valid access cookie passes)", () => {
  const tokenService = new JwtTokenService({ secret: SECRET });
  const guard = new JwtAuthGuard(tokenService);

  it("passes and attaches the principal when the cookie holds a valid token", async () => {
    const { accessToken } = await tokenService.issuePair({ userId: "u1", role: "member" });
    const request: ITestRequest = { cookies: { [ACCESS_TOKEN_COOKIE]: accessToken } };

    expect(guard.canActivate(contextWith(request))).toBe(true);
    expect(request.user).toEqual({ id: "u1", role: "member" });
  });

  it("also reads the token from the raw Cookie header (no cookie-parser)", async () => {
    const { accessToken } = await tokenService.issuePair({ userId: "u2", role: "admin" });
    const request: ITestRequest = { headers: { cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}` } };

    expect(guard.canActivate(contextWith(request))).toBe(true);
    expect(request.user).toEqual({ id: "u2", role: "admin" });
  });
});

describe("JwtAuthGuard (AC6: missing/invalid access cookie => 401)", () => {
  const tokenService = new JwtTokenService({ secret: SECRET });
  const guard = new JwtAuthGuard(tokenService);

  it("rejects a request with no access cookie", () => {
    expect(() => guard.canActivate(contextWith({ cookies: {} }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it("rejects a malformed/garbage token", () => {
    const request: ITestRequest = { cookies: { [ACCESS_TOKEN_COOKIE]: "not-a-jwt" } };
    expect(() => guard.canActivate(contextWith(request))).toThrow(UnauthorizedException);
  });

  it("rejects an expired token", async () => {
    const shortLived = new JwtTokenService({ secret: SECRET, accessTokenTtlSeconds: -1 });
    const { accessToken } = await shortLived.issuePair({ userId: "u1", role: "member" });
    const request: ITestRequest = { cookies: { [ACCESS_TOKEN_COOKIE]: accessToken } };
    expect(() => guard.canActivate(contextWith(request))).toThrow(UnauthorizedException);
  });

  it("rejects a refresh token presented as an access token", async () => {
    const { refreshToken } = await tokenService.issuePair({ userId: "u1", role: "member" });
    const request: ITestRequest = { cookies: { [ACCESS_TOKEN_COOKIE]: refreshToken } };
    expect(() => guard.canActivate(contextWith(request))).toThrow(UnauthorizedException);
  });
});

describe("currentUserFactory (AC7: exposes the principal)", () => {
  it("returns the principal attached by the guard", () => {
    const user: ICurrentUser = { id: "u9", role: "admin" };
    expect(currentUserFactory(undefined, contextWith({ user }))).toEqual(user);
  });

  it("returns undefined when no principal is attached", () => {
    expect(currentUserFactory(undefined, contextWith({}))).toBeUndefined();
  });
});

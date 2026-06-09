import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { HandleOAuthCallback } from "../application/handle-oauth-callback.usecase";
import type { Logout } from "../application/logout.usecase";
import type { RefreshSession } from "../application/refresh-session.usecase";
import type { StartOAuth } from "../application/start-oauth.usecase";
import type { ICurrentUser } from "../domain/types/current-user.type";
import { type IProviderName, Provider } from "../domain/value-objects/provider.vo";
import {
  ACCESS_TOKEN_COOKIE,
  type ICookie,
  REFRESH_TOKEN_COOKIE,
  buildAuthCookie,
  buildClearCookie,
  serializeCookie,
} from "../infrastructure/http/cookie.helper";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../infrastructure/token/jwt-token.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

/** Short-lived cookie holding the signed OAuth state for CSRF validation (AC5). */
const STATE_COOKIE = "oauth_state";
const STATE_TTL_SECONDS = 600;

export const AUTH_CONTROLLER_CONFIG = Symbol("AUTH_CONTROLLER_CONFIG");

export interface IAuthControllerConfig {
  /** Base URL the providers redirect back to, e.g. http://localhost:3001. */
  callbackBaseUrl: string;
  /** Frontend base URL; login lands on its root and errors on /login-error. */
  frontendUrl: string;
  /** Whether to mark cookies Secure (off for local http dev). */
  cookieSecure: boolean;
}

/** Minimal response surface used here (Express Response satisfies it structurally). */
export interface IAuthResponse {
  setHeader(name: string, value: string | string[]): void;
  redirect(url: string): void;
  status(code: number): IAuthResponse;
  json(body: unknown): void;
}

export interface IAuthRequest {
  cookies?: Record<string, string | undefined>;
  headers?: { cookie?: string };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly startOAuth: StartOAuth,
    private readonly handleCallback: HandleOAuthCallback,
    private readonly refreshSession: RefreshSession,
    private readonly logout: Logout,
    @Inject(AUTH_CONTROLLER_CONFIG) private readonly config: IAuthControllerConfig,
  ) {}

  @Get(":provider/start")
  start(@Param("provider") providerParam: string, @Res() res: IAuthResponse): void {
    const provider = this.assertProvider(providerParam);
    const { authorizeUrl, state } = this.startOAuth.execute({
      provider,
      redirectUri: this.redirectUri(provider),
    });
    this.setCookies(res, [
      buildAuthCookie(STATE_COOKIE, state, this.config.cookieSecure, STATE_TTL_SECONDS),
    ]);
    res.redirect(authorizeUrl);
  }

  @Get(":provider/callback")
  async callback(
    @Param("provider") providerParam: string,
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: IAuthRequest,
    @Res() res: IAuthResponse,
  ): Promise<void> {
    if (!Provider.isSupported(providerParam)) {
      res.redirect(this.loginErrorUrl());
      return;
    }
    const cookieState = AuthController.readCookie(req, STATE_COOKIE) ?? "";
    try {
      const result = await this.handleCallback.execute({
        provider: providerParam,
        code: code ?? "",
        state: state ?? "",
        cookieState,
        redirectUri: this.redirectUri(providerParam),
      });
      this.setCookies(res, [
        buildAuthCookie(
          ACCESS_TOKEN_COOKIE,
          result.accessToken,
          this.config.cookieSecure,
          ACCESS_TOKEN_TTL_SECONDS,
        ),
        buildAuthCookie(
          REFRESH_TOKEN_COOKIE,
          result.refreshToken,
          this.config.cookieSecure,
          REFRESH_TOKEN_TTL_SECONDS,
        ),
        // single-use: clear the state cookie now that it has been consumed
        buildClearCookie(STATE_COOKIE, this.config.cookieSecure),
      ]);
      res.redirect(this.homeUrl());
    } catch {
      // No session issued; clear state and send the browser to the error route (AC5).
      this.setCookies(res, [buildClearCookie(STATE_COOKIE, this.config.cookieSecure)]);
      res.redirect(this.loginErrorUrl());
    }
  }

  @Post("refresh")
  async refresh(@Req() req: IAuthRequest, @Res() res: IAuthResponse): Promise<void> {
    const refreshToken = AuthController.readCookie(req, REFRESH_TOKEN_COOKIE) ?? "";
    try {
      const result = await this.refreshSession.execute({ refreshToken });
      this.setCookies(res, [
        buildAuthCookie(
          ACCESS_TOKEN_COOKIE,
          result.accessToken,
          this.config.cookieSecure,
          ACCESS_TOKEN_TTL_SECONDS,
        ),
        buildAuthCookie(
          REFRESH_TOKEN_COOKIE,
          result.refreshToken,
          this.config.cookieSecure,
          REFRESH_TOKEN_TTL_SECONDS,
        ),
      ]);
      res.status(200).json({ ok: true });
    } catch {
      res.status(401).json({ message: "Invalid refresh token" });
    }
  }

  @Post("logout")
  async doLogout(@Req() req: IAuthRequest, @Res() res: IAuthResponse): Promise<void> {
    const refreshToken = AuthController.readCookie(req, REFRESH_TOKEN_COOKIE);
    await this.logout.execute({ refreshToken });
    this.setCookies(res, [
      buildClearCookie(ACCESS_TOKEN_COOKIE, this.config.cookieSecure),
      buildClearCookie(REFRESH_TOKEN_COOKIE, this.config.cookieSecure),
    ]);
    res.status(200).json({ ok: true });
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: ICurrentUser): ICurrentUser {
    return user;
  }

  private assertProvider(value: string): IProviderName {
    if (!Provider.isSupported(value)) {
      throw new NotFoundException(`Unknown provider: ${value}`);
    }
    return value;
  }

  private redirectUri(provider: IProviderName): string {
    return `${this.config.callbackBaseUrl}/auth/${provider}/callback`;
  }

  private homeUrl(): string {
    return `${this.config.frontendUrl}/`;
  }

  private loginErrorUrl(): string {
    return `${this.config.frontendUrl}/login-error`;
  }

  private setCookies(res: IAuthResponse, cookies: ICookie[]): void {
    res.setHeader("Set-Cookie", cookies.map(serializeCookie));
  }

  private static readCookie(req: IAuthRequest, name: string): string | undefined {
    const fromParser = req.cookies?.[name];
    if (fromParser) {
      return fromParser;
    }
    const header = req.headers?.cookie;
    if (!header) {
      return undefined;
    }
    for (const part of header.split(";")) {
      const index = part.indexOf("=");
      if (index === -1) {
        continue;
      }
      if (part.slice(0, index).trim() === name) {
        return decodeURIComponent(part.slice(index + 1).trim());
      }
    }
    return undefined;
  }
}

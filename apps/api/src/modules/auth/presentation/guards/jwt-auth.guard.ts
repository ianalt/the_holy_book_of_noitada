import { type CanActivate, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { ITokenService } from "../../domain/ports/token-service.port";
import type { ICurrentUser } from "../../domain/types/current-user.type";
import { ACCESS_TOKEN_COOKIE } from "../../infrastructure/http/cookie.helper";

interface IRequestWithCookies {
  cookies?: Record<string, string | undefined>;
  headers?: { cookie?: string };
  user?: ICurrentUser;
}

/**
 * Protects routes by requiring a valid `access_token` cookie. A missing or
 * invalid/expired token is rejected with 401 (AC6); a valid token attaches the
 * principal to the request (for `@CurrentUser`) and lets the request pass (AC7).
 */
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: ITokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<IRequestWithCookies>();
    const token = JwtAuthGuard.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    let user: ICurrentUser;
    try {
      user = this.tokenService.verifyAccess(token);
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }

    request.user = user;
    return true;
  }

  private static extractToken(request: IRequestWithCookies): string | undefined {
    const fromParser = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (fromParser) {
      return fromParser;
    }
    const header = request.headers?.cookie;
    if (!header) {
      return undefined;
    }
    for (const part of header.split(";")) {
      const index = part.indexOf("=");
      if (index === -1) {
        continue;
      }
      if (part.slice(0, index).trim() === ACCESS_TOKEN_COOKIE) {
        return decodeURIComponent(part.slice(index + 1).trim());
      }
    }
    return undefined;
  }
}

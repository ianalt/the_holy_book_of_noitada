import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type {
  IIssueTokensInput,
  IIssuedTokens,
  IRefreshTokenClaims,
  ITokenService,
} from "../../domain/ports/token-service.port";
import type { ICurrentUser } from "../../domain/types/current-user.type";

/** ~15 minutes access TTL (NFR). */
const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
/** ~7 days refresh TTL (NFR). */
const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export const ACCESS_TOKEN_TTL_SECONDS = DEFAULT_ACCESS_TTL_SECONDS;
export const REFRESH_TOKEN_TTL_SECONDS = DEFAULT_REFRESH_TTL_SECONDS;

export interface IJwtTokenServiceConfig {
  secret: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
}

/** SHA-256 hex digest. Used so only the hash of a refresh token is ever stored. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * JWT implementation of the ITokenService port. Access tokens carry sub+role
 * (AC6/AC7); refresh tokens carry a unique `jti` so every issue/rotation yields a
 * distinct token and hash (AC8). Only the refresh hash is persisted (security).
 */
export class JwtTokenService implements ITokenService {
  private readonly secret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(config: IJwtTokenServiceConfig) {
    if (!config.secret) {
      throw new Error("JwtTokenService requires a non-empty secret");
    }
    this.secret = config.secret;
    this.accessTtl = config.accessTokenTtlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS;
    this.refreshTtl = config.refreshTokenTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;
  }

  issuePair(input: IIssueTokensInput): Promise<IIssuedTokens> {
    const accessToken = jwt.sign(
      { sub: input.userId, role: input.role, type: "access" },
      this.secret,
      {
        expiresIn: this.accessTtl,
      },
    );
    const refreshToken = jwt.sign(
      { sub: input.userId, type: "refresh", jti: randomUUID() },
      this.secret,
      {
        expiresIn: this.refreshTtl,
      },
    );
    return Promise.resolve({
      accessToken,
      refreshToken,
      refreshTokenHash: sha256(refreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + this.refreshTtl * 1000),
    });
  }

  verifyAccess(token: string): ICurrentUser {
    const payload = this.verify(token);
    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string"
    ) {
      throw new Error("Not a valid access token");
    }
    return { id: payload.sub, role: payload.role };
  }

  verifyRefresh(token: string): IRefreshTokenClaims {
    const payload = this.verify(token);
    if (payload.type !== "refresh" || typeof payload.sub !== "string") {
      throw new Error("Not a valid refresh token");
    }
    return { userId: payload.sub, tokenHash: sha256(token) };
  }

  /** Verifies signature + expiry; throws on any invalid/expired token. */
  private verify(token: string): jwt.JwtPayload {
    const decoded = jwt.verify(token, this.secret);
    if (typeof decoded === "string") {
      throw new Error("Unexpected token payload");
    }
    return decoded;
  }
}

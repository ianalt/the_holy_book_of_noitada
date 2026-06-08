import type { ICurrentUser } from "../types/current-user.type";
import type { ITokenPair } from "../types/token-pair.type";

export interface IIssueTokensInput {
  userId: string;
  role: string;
}

/** Issued tokens plus the metadata needed to persist the refresh token (AC8). */
export interface IIssuedTokens extends ITokenPair {
  /** SHA-256 of the refresh token; only the hash is stored (security constraint). */
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

/** Verified refresh-token claims used to look up and rotate the stored token (AC8). */
export interface IRefreshTokenClaims {
  userId: string;
  /** SHA-256 of the presented token, for the repository lookup. */
  tokenHash: string;
}

/**
 * Port for issuing and verifying JWTs. Concrete `JwtTokenService` in
 * infrastructure (T-005). Access tokens carry sub+role (AC6/AC7); refresh tokens
 * are rotated on every use (AC8). Verify methods throw on invalid/expired tokens.
 */
export interface ITokenService {
  issuePair(input: IIssueTokensInput): Promise<IIssuedTokens>;
  verifyAccess(token: string): ICurrentUser;
  verifyRefresh(token: string): IRefreshTokenClaims;
}

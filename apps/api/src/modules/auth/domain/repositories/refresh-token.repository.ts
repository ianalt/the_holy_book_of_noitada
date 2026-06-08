export interface IRefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ICreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Persistence boundary for refresh tokens (a rotation detail, not a domain
 * entity). Supports rotation (AC8: find the presented token by hash, revoke it,
 * persist the replacement) and logout (AC9: revoke). Only hashes are stored,
 * never raw tokens (security constraint).
 */
export abstract class RefreshTokenRepository {
  abstract create(input: ICreateRefreshTokenInput): Promise<IRefreshTokenRecord>;
  abstract findByTokenHash(tokenHash: string): Promise<IRefreshTokenRecord | null>;
  abstract revoke(id: string): Promise<void>;
  abstract revokeAllForUser(userId: string): Promise<void>;
}

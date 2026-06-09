import type { ITokenService } from "../domain/ports/token-service.port";
import type { RefreshTokenRepository } from "../domain/repositories/refresh-token.repository";
import type { UserRepository } from "../domain/repositories/user.repository";
import type { ICurrentUser } from "../domain/types/current-user.type";

/**
 * Raised when a refresh cannot proceed: invalid/expired token, or a stored record
 * that is missing, revoked or expired. The controller maps this to 401 (AC8).
 */
export class RefreshSessionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RefreshSessionError";
  }
}

export interface IRefreshSessionCommand {
  /** The raw refresh token from the httpOnly cookie. */
  refreshToken: string;
}

export interface IRefreshSessionResult {
  accessToken: string;
  refreshToken: string;
  user: ICurrentUser;
}

/**
 * Rotates a session from a valid refresh token (AC8): verify the token, confirm
 * the stored record is still active (rejecting reuse of an already-rotated or
 * revoked token), revoke that record, then issue and persist a fresh pair. Any
 * invalid/expired/revoked input yields a RefreshSessionError (→ 401).
 */
export class RefreshSession {
  constructor(
    private readonly tokenService: ITokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(command: IRefreshSessionCommand): Promise<IRefreshSessionResult> {
    let claims: { userId: string; tokenHash: string };
    try {
      claims = this.tokenService.verifyRefresh(command.refreshToken);
    } catch (cause) {
      throw new RefreshSessionError("Invalid refresh token", { cause });
    }

    const record = await this.refreshTokenRepository.findByTokenHash(claims.tokenHash);
    if (
      !record ||
      record.revokedAt !== null ||
      record.userId !== claims.userId ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new RefreshSessionError("Refresh token is not active");
    }

    const user = await this.userRepository.findById(claims.userId);
    if (!user) {
      throw new RefreshSessionError("User not found for refresh token");
    }

    // Rotation: revoke the presented token, then issue and persist a new pair.
    await this.refreshTokenRepository.revoke(record.id);

    const issued = await this.tokenService.issuePair({ userId: user.id, role: user.role });
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: issued.refreshTokenHash,
      expiresAt: issued.refreshTokenExpiresAt,
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      user: { id: user.id, role: user.role },
    };
  }
}

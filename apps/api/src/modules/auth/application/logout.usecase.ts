import type { ITokenService } from "../domain/ports/token-service.port";
import type { RefreshTokenRepository } from "../domain/repositories/refresh-token.repository";

export interface ILogoutCommand {
  /** The raw refresh token from the cookie, if present. */
  refreshToken?: string;
}

/**
 * Logout (AC9): revokes the presented refresh token's stored row so it can no
 * longer be rotated. Idempotent — a missing, invalid, expired or already-revoked
 * token resolves without error; the controller always clears the cookies and
 * returns 200 regardless.
 */
export class Logout {
  constructor(
    private readonly tokenService: ITokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(command: ILogoutCommand): Promise<void> {
    const token = command.refreshToken;
    if (!token) {
      return;
    }

    let tokenHash: string;
    try {
      tokenHash = this.tokenService.verifyRefresh(token).tokenHash;
    } catch {
      // Invalid/expired token — nothing to revoke; logout stays idempotent.
      return;
    }

    const record = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (record && record.revokedAt === null) {
      await this.refreshTokenRepository.revoke(record.id);
    }
  }
}

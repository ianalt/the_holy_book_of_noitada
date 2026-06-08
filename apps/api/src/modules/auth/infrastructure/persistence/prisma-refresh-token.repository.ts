import type { PrismaClient } from "@prisma/client";
import {
  type ICreateRefreshTokenInput,
  type IRefreshTokenRecord,
  RefreshTokenRepository,
} from "../../domain/repositories/refresh-token.repository";

interface IRefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * Prisma implementation of RefreshTokenRepository. Supports rotation (AC8: find
 * the presented token by hash, revoke it, persist the replacement) and logout
 * (AC9: revoke). Only hashes are ever written (security constraint).
 */
export class PrismaRefreshTokenRepository extends RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async create(input: ICreateRefreshTokenInput): Promise<IRefreshTokenRecord> {
    const row = await this.prisma.refreshToken.create({
      data: { userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
    });
    return PrismaRefreshTokenRepository.toRecord(row);
  }

  async findByTokenHash(tokenHash: string): Promise<IRefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return row ? PrismaRefreshTokenRepository.toRecord(row) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private static toRecord(row: IRefreshTokenRow): IRefreshTokenRecord {
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }
}

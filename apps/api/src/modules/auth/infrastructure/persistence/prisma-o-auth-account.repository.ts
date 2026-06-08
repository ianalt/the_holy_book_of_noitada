import type { PrismaClient } from "@prisma/client";
import { OAuthAccount } from "../../domain/entities/o-auth-account.entity";
import {
  type ICreateOAuthAccountInput,
  OAuthAccountRepository,
} from "../../domain/repositories/o-auth-account.repository";
import { Provider } from "../../domain/value-objects/provider.vo";

interface IOAuthAccountRow {
  id: string;
  provider: string;
  providerUserId: string;
  userId: string;
  createdAt: Date;
}

/**
 * Prisma implementation of OAuthAccountRepository. `findByProviderAccount`
 * detects a returning same-provider login; `create` links a provider identity to
 * a User (AC3 first login, AC4 linking). The `@@unique([provider, providerUserId])`
 * constraint prevents duplicate provider identities.
 */
export class PrismaOAuthAccountRepository extends OAuthAccountRepository {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async findByProviderAccount(
    provider: Provider,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    const row = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: provider.value, providerUserId } },
    });
    return row ? PrismaOAuthAccountRepository.toEntity(row) : null;
  }

  async create(input: ICreateOAuthAccountInput): Promise<OAuthAccount> {
    const row = await this.prisma.oAuthAccount.create({
      data: {
        provider: input.provider.value,
        providerUserId: input.providerUserId,
        userId: input.userId,
      },
    });
    return PrismaOAuthAccountRepository.toEntity(row);
  }

  private static toEntity(row: IOAuthAccountRow): OAuthAccount {
    return new OAuthAccount({
      id: row.id,
      provider: Provider.create(row.provider),
      providerUserId: row.providerUserId,
      userId: row.userId,
      createdAt: row.createdAt,
    });
  }
}

import type { OAuthAccount } from "../entities/o-auth-account.entity";
import type { Provider } from "../value-objects/provider.vo";

export interface ICreateOAuthAccountInput {
  provider: Provider;
  providerUserId: string;
  userId: string;
}

/**
 * Persistence boundary for OAuthAccounts. `findByProviderAccount` detects a
 * returning same-provider login; `create` links a provider identity to a User
 * (AC3 first login, AC4 linking a new provider to an existing User).
 */
export abstract class OAuthAccountRepository {
  abstract findByProviderAccount(
    provider: Provider,
    providerUserId: string,
  ): Promise<OAuthAccount | null>;
  abstract create(input: ICreateOAuthAccountInput): Promise<OAuthAccount>;
}

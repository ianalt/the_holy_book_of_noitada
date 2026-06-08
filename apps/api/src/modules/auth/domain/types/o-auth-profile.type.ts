import type { IProviderName } from "../value-objects/provider.vo";

/**
 * Normalized identity returned by a provider after the code→token exchange.
 * `emailVerified` is the gate for cross-provider linking (AC4): linking proceeds
 * only when the provider reports the email as verified.
 */
export interface IOAuthProfile {
  provider: IProviderName;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

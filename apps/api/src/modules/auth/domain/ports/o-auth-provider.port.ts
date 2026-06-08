import type { IOAuthProfile } from "../types/o-auth-profile.type";
import type { IProviderName } from "../value-objects/provider.vo";

export interface IAuthorizeUrlParams {
  /** Single-use CSRF token echoed back on the callback (AC5). */
  state: string;
  /** Backend callback URL the provider redirects to (AC1, AC2). */
  redirectUri: string;
}

export interface IExchangeCodeParams {
  code: string;
  redirectUri: string;
}

/** Raw token(s) returned by the provider's token endpoint. */
export interface IOAuthTokens {
  accessToken: string;
  idToken?: string;
}

/**
 * Strategy for one OAuth2 provider (Google/Discord). Concrete implementations
 * live in infrastructure (T-007). `authorizeUrl` builds the consent-screen URL
 * with the backend redirect URI (AC1, AC2); `fetchProfile` returns the normalized
 * identity carrying `emailVerified` for the linking gate (AC4).
 */
export interface IOAuthProvider {
  readonly name: IProviderName;
  authorizeUrl(params: IAuthorizeUrlParams): string;
  exchangeCode(params: IExchangeCodeParams): Promise<IOAuthTokens>;
  fetchProfile(tokens: IOAuthTokens): Promise<IOAuthProfile>;
}

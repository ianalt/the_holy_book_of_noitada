import type { IOAuthProvider } from "../domain/ports/o-auth-provider.port";
import type { IProviderName } from "../domain/value-objects/provider.vo";

/**
 * Outbound port for minting the signed OAuth `state` (AC5). Declared by the
 * application layer and implemented by infrastructure's StateService (wired in
 * T-013); kept here so this use case depends only on the domain.
 */
export interface IStateIssuer {
  issue(): string;
}

export interface IStartOAuthCommand {
  /** Provider name from the route param (e.g. "google", "discord"). */
  provider: IProviderName;
  /** Backend callback URL the provider must redirect back to (AC1, AC2). */
  redirectUri: string;
}

export interface IStartOAuthResult {
  /** Provider consent-screen URL to redirect the browser to. */
  authorizeUrl: string;
  /** Signed state to be stored by the controller as a short-lived httpOnly cookie. */
  state: string;
}

/**
 * Starts the OAuth2 Authorization Code flow: mints a state, asks the selected
 * provider to build its consent-screen URL with the backend redirect URI, and
 * returns both the URL (to redirect to) and the state (to set as a cookie).
 * Satisfies AC1 (Google) and AC2 (Discord).
 */
export class StartOAuth {
  constructor(
    private readonly providers: Record<IProviderName, IOAuthProvider>,
    private readonly stateIssuer: IStateIssuer,
  ) {}

  execute(command: IStartOAuthCommand): IStartOAuthResult {
    const provider = this.providers[command.provider];
    if (!provider) {
      throw new Error(`Unsupported provider: ${command.provider}`);
    }
    const state = this.stateIssuer.issue();
    const authorizeUrl = provider.authorizeUrl({ state, redirectUri: command.redirectUri });
    return { authorizeUrl, state };
  }
}

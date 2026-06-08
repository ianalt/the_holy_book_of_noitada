import type {
  IAuthorizeUrlParams,
  IExchangeCodeParams,
  IOAuthProvider,
  IOAuthTokens,
} from "../../domain/ports/o-auth-provider.port";
import type { IOAuthProfile } from "../../domain/types/o-auth-profile.type";

const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USER_URL = "https://discord.com/api/users/@me";
const SCOPE = "identify email";

export interface IDiscordProviderConfig {
  clientId: string;
  clientSecret: string;
}

interface IDiscordTokenResponse {
  access_token: string;
}

interface IDiscordUser {
  id: string;
  email?: string;
  verified?: boolean;
  username?: string;
  global_name?: string;
}

/**
 * Discord OAuth2 provider. `authorizeUrl` builds the consent-screen URL with the
 * backend redirect URI and state (AC2). `fetchProfile` maps Discord's `verified`
 * flag to `emailVerified`, which gates cross-provider linking (AC4).
 */
export class DiscordProvider implements IOAuthProvider {
  readonly name = "discord" as const;

  constructor(private readonly config: IDiscordProviderConfig) {}

  authorizeUrl(params: IAuthorizeUrlParams): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  async exchangeCode(params: IExchangeCodeParams): Promise<IOAuthTokens> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: params.code,
        grant_type: "authorization_code",
        redirect_uri: params.redirectUri,
      }),
    });
    if (!res.ok) {
      throw new Error(`Discord token exchange failed (${res.status})`);
    }
    const data = (await res.json()) as IDiscordTokenResponse;
    return { accessToken: data.access_token };
  }

  async fetchProfile(tokens: IOAuthTokens): Promise<IOAuthProfile> {
    const res = await fetch(USER_URL, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Discord profile fetch failed (${res.status})`);
    }
    const user = (await res.json()) as IDiscordUser;
    return {
      provider: "discord",
      providerUserId: user.id,
      email: user.email ?? "",
      emailVerified: user.verified === true,
      displayName: user.global_name ?? user.username,
    };
  }
}

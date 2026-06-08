import type {
  IAuthorizeUrlParams,
  IExchangeCodeParams,
  IOAuthProvider,
  IOAuthTokens,
} from "../../domain/ports/o-auth-provider.port";
import type { IOAuthProfile } from "../../domain/types/o-auth-profile.type";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const SCOPE = "openid email profile";

export interface IGoogleProviderConfig {
  clientId: string;
  clientSecret: string;
}

interface IGoogleTokenResponse {
  access_token: string;
  id_token?: string;
}

interface IGoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
}

/**
 * Google OAuth2 provider. `authorizeUrl` builds the consent-screen URL with the
 * backend redirect URI and state (AC1). `fetchProfile` reports `emailVerified`
 * from Google's `email_verified` flag, feeding the linking gate (AC4).
 */
export class GoogleProvider implements IOAuthProvider {
  readonly name = "google" as const;

  constructor(private readonly config: IGoogleProviderConfig) {}

  authorizeUrl(params: IAuthorizeUrlParams): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", params.state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
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
      throw new Error(`Google token exchange failed (${res.status})`);
    }
    const data = (await res.json()) as IGoogleTokenResponse;
    return { accessToken: data.access_token, idToken: data.id_token };
  }

  async fetchProfile(tokens: IOAuthTokens): Promise<IOAuthProfile> {
    const res = await fetch(USERINFO_URL, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Google profile fetch failed (${res.status})`);
    }
    const info = (await res.json()) as IGoogleUserInfo;
    return {
      provider: "google",
      providerUserId: info.sub,
      email: info.email,
      emailVerified: info.email_verified ?? false,
      displayName: info.name,
    };
  }
}

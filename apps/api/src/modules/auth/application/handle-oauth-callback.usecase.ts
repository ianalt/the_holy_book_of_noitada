import type { User } from "../domain/entities/user.entity";
import type { IOAuthProvider } from "../domain/ports/o-auth-provider.port";
import type { ITokenService } from "../domain/ports/token-service.port";
import type { OAuthAccountRepository } from "../domain/repositories/o-auth-account.repository";
import type { RefreshTokenRepository } from "../domain/repositories/refresh-token.repository";
import type { UserRepository } from "../domain/repositories/user.repository";
import type { ICurrentUser } from "../domain/types/current-user.type";
import type { IOAuthProfile } from "../domain/types/o-auth-profile.type";
import { Email } from "../domain/value-objects/email.vo";
import { Provider } from "../domain/value-objects/provider.vo";
import type { IProviderName } from "../domain/value-objects/provider.vo";

/**
 * Raised whenever the callback cannot produce a session: bad/expired state,
 * failed code exchange, or an unverified email. The controller maps this to 401 +
 * redirect to the login-error route (AC5) — never a session.
 */
export class OAuthCallbackError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OAuthCallbackError";
  }
}

/**
 * Outbound port for validating the OAuth `state` (AC5). Declared by the
 * application; implemented by infrastructure's StateService (wired in T-013).
 */
export interface IStateValidator {
  validate(queryState: string, cookieState: string): boolean;
}

export interface IHandleOAuthCallbackCommand {
  provider: IProviderName;
  code: string;
  /** `state` echoed back by the provider on the callback. */
  state: string;
  /** `state` previously stored in the httpOnly cookie at the start of the flow. */
  cookieState: string;
  /** Backend callback URL (must match the one used to start the flow). */
  redirectUri: string;
}

export interface IHandleOAuthCallbackResult {
  accessToken: string;
  refreshToken: string;
  user: ICurrentUser;
}

/**
 * Completes the OAuth2 Authorization Code flow on the callback: validate state
 * (AC5), exchange the code and fetch the profile (AC5 on failure), enforce the
 * verified-email gate (AC4 security), resolve the account
 * (returning-login → link-by-email → create), then issue and persist the session
 * tokens. Satisfies AC3 (first login) and AC4 (linking).
 */
export class HandleOAuthCallback {
  constructor(
    private readonly providers: Record<IProviderName, IOAuthProvider>,
    private readonly stateValidator: IStateValidator,
    private readonly userRepository: UserRepository,
    private readonly oAuthAccountRepository: OAuthAccountRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: ITokenService,
  ) {}

  async execute(command: IHandleOAuthCallbackCommand): Promise<IHandleOAuthCallbackResult> {
    const provider = this.providers[command.provider];
    if (!provider) {
      throw new OAuthCallbackError(`Unsupported provider: ${command.provider}`);
    }

    if (!this.stateValidator.validate(command.state, command.cookieState)) {
      throw new OAuthCallbackError("Invalid OAuth state");
    }

    let profile: IOAuthProfile;
    try {
      const tokens = await provider.exchangeCode({
        code: command.code,
        redirectUri: command.redirectUri,
      });
      profile = await provider.fetchProfile(tokens);
    } catch (cause) {
      throw new OAuthCallbackError("OAuth code exchange failed", { cause });
    }

    if (!profile.emailVerified) {
      throw new OAuthCallbackError("Provider reports the email as unverified");
    }

    let email: Email;
    try {
      email = Email.create(profile.email);
    } catch (cause) {
      throw new OAuthCallbackError("Provider returned an invalid email", { cause });
    }

    const providerVo = Provider.create(command.provider);
    const user = await this.resolveUser(providerVo, profile.providerUserId, email);

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

  /**
   * Resolves the User for this login: (1) a returning same-provider account,
   * (2) link a new provider to an existing User matched by verified email (AC4),
   * or (3) create a new User + OAuthAccount on first login (AC3).
   */
  private async resolveUser(
    provider: Provider,
    providerUserId: string,
    email: Email,
  ): Promise<User> {
    const existingAccount = await this.oAuthAccountRepository.findByProviderAccount(
      provider,
      providerUserId,
    );
    if (existingAccount) {
      const user = await this.userRepository.findById(existingAccount.userId);
      if (!user) {
        throw new OAuthCallbackError("Linked user not found");
      }
      return user;
    }

    const linkedUser = await this.userRepository.findByEmail(email);
    if (linkedUser) {
      await this.oAuthAccountRepository.create({
        provider,
        providerUserId,
        userId: linkedUser.id,
      });
      return linkedUser;
    }

    const newUser = await this.userRepository.create({ email });
    await this.oAuthAccountRepository.create({ provider, providerUserId, userId: newUser.id });
    return newUser;
  }
}

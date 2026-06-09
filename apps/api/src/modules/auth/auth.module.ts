import { Module } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { HandleOAuthCallback } from "./application/handle-oauth-callback.usecase";
import { Logout } from "./application/logout.usecase";
import { RefreshSession } from "./application/refresh-session.usecase";
import { StartOAuth } from "./application/start-oauth.usecase";
import type { IOAuthProvider } from "./domain/ports/o-auth-provider.port";
import { OAuthAccountRepository } from "./domain/repositories/o-auth-account.repository";
import { RefreshTokenRepository } from "./domain/repositories/refresh-token.repository";
import { UserRepository } from "./domain/repositories/user.repository";
import type { IProviderName } from "./domain/value-objects/provider.vo";
import { PrismaOAuthAccountRepository } from "./infrastructure/persistence/prisma-o-auth-account.repository";
import { PrismaRefreshTokenRepository } from "./infrastructure/persistence/prisma-refresh-token.repository";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user.repository";
import { DiscordProvider } from "./infrastructure/providers/discord.provider";
import { GoogleProvider } from "./infrastructure/providers/google.provider";
import { StateService } from "./infrastructure/providers/state";
import { JwtTokenService } from "./infrastructure/token/jwt-token.service";
import {
  AUTH_CONTROLLER_CONFIG,
  AuthController,
  type IAuthControllerConfig,
} from "./presentation/auth.controller";
import { JwtAuthGuard } from "./presentation/guards/jwt-auth.guard";

// Injection tokens for the ports that are interfaces (and so cannot be class tokens).
export const PRISMA_CLIENT = Symbol("PRISMA_CLIENT");
export const TOKEN_SERVICE = Symbol("TOKEN_SERVICE");
export const STATE_SERVICE = Symbol("STATE_SERVICE");
export const OAUTH_PROVIDERS = Symbol("OAUTH_PROVIDERS");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Auth bounded-context module (T-013). Wires the domain ports to their concrete
 * implementations: Prisma repositories, the JWT token service, the signed-state
 * service, and the Google/Discord providers, then composes the use cases and the
 * controller. Use cases receive their dependencies through explicit factories so
 * the application layer stays free of any framework coupling.
 */
@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: (): PrismaClient =>
        new PrismaClient({
          adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }),
        }),
    },
    {
      provide: UserRepository,
      useFactory: (prisma: PrismaClient) => new PrismaUserRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: OAuthAccountRepository,
      useFactory: (prisma: PrismaClient) => new PrismaOAuthAccountRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: RefreshTokenRepository,
      useFactory: (prisma: PrismaClient) => new PrismaRefreshTokenRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: TOKEN_SERVICE,
      useFactory: () => new JwtTokenService({ secret: requireEnv("JWT_SECRET") }),
    },
    {
      provide: STATE_SERVICE,
      useFactory: () => new StateService({ secret: requireEnv("JWT_SECRET") }),
    },
    {
      provide: OAUTH_PROVIDERS,
      useFactory: (): Record<IProviderName, IOAuthProvider> => ({
        google: new GoogleProvider({
          clientId: requireEnv("GOOGLE_CLIENT_ID"),
          clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
        }),
        discord: new DiscordProvider({
          clientId: requireEnv("DISCORD_CLIENT_ID"),
          clientSecret: requireEnv("DISCORD_CLIENT_SECRET"),
        }),
      }),
    },
    {
      provide: StartOAuth,
      useFactory: (providers: Record<IProviderName, IOAuthProvider>, state: StateService) =>
        new StartOAuth(providers, state),
      inject: [OAUTH_PROVIDERS, STATE_SERVICE],
    },
    {
      provide: HandleOAuthCallback,
      useFactory: (
        providers: Record<IProviderName, IOAuthProvider>,
        state: StateService,
        users: UserRepository,
        accounts: OAuthAccountRepository,
        tokens: RefreshTokenRepository,
        tokenService: JwtTokenService,
      ) => new HandleOAuthCallback(providers, state, users, accounts, tokens, tokenService),
      inject: [
        OAUTH_PROVIDERS,
        STATE_SERVICE,
        UserRepository,
        OAuthAccountRepository,
        RefreshTokenRepository,
        TOKEN_SERVICE,
      ],
    },
    {
      provide: RefreshSession,
      useFactory: (
        tokenService: JwtTokenService,
        tokens: RefreshTokenRepository,
        users: UserRepository,
      ) => new RefreshSession(tokenService, tokens, users),
      inject: [TOKEN_SERVICE, RefreshTokenRepository, UserRepository],
    },
    {
      provide: Logout,
      useFactory: (tokenService: JwtTokenService, tokens: RefreshTokenRepository) =>
        new Logout(tokenService, tokens),
      inject: [TOKEN_SERVICE, RefreshTokenRepository],
    },
    {
      provide: JwtAuthGuard,
      useFactory: (tokenService: JwtTokenService) => new JwtAuthGuard(tokenService),
      inject: [TOKEN_SERVICE],
    },
    {
      provide: AUTH_CONTROLLER_CONFIG,
      useFactory: (): IAuthControllerConfig => ({
        callbackBaseUrl: requireEnv("OAUTH_CALLBACK_URL"),
        frontendUrl: requireEnv("FRONTEND_URL"),
        cookieSecure: process.env.NODE_ENV === "production",
      }),
    },
  ],
})
export class AuthModule {}

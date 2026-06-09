# Tasks: Auth

> Atomic, ordered tasks. Each references the files it touches and the AC(s) it covers.
> The agent executes ONE at a time; a task is checked only when all gates pass.
> Greenfield: `apps/api` introduces its first bounded context `modules/auth/`.

## Database & domain foundations

- [x] T-001 db: Define `User`, `OAuthAccount`, `RefreshToken` models and generate the
  initial migration.
  - Files: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`
  - Notes: `User.email @unique`, `User.role @default("member")`,
    `OAuthAccount @@unique([provider, providerUserId])`, `RefreshToken.tokenHash @unique` + `revokedAt`.
  - Covers AC3, AC4 (constraints), AC8, AC9 (rotation/revocation storage)

- [x] T-002 domain: Value objects `Email` and `Provider`, plus shared types
  `IOAuthProfile`, `ITokenPair`, `ICurrentUser`.
  - Files: `apps/api/src/modules/auth/domain/value-objects/{email,provider}.vo.ts`,
    `apps/api/src/modules/auth/domain/types/*.ts`
  - Notes: `Provider` accepts only `google | discord`; `IOAuthProfile` carries `emailVerified`.
  - Covers AC4 (verified-email), AC1, AC2 (provider constraint)

- [x] T-003 domain: Entities `User`, `OAuthAccount` and abstract repositories
  `UserRepository`, `OAuthAccountRepository`, `RefreshTokenRepository`.
  - Files: `apps/api/src/modules/auth/domain/entities/*.ts`,
    `apps/api/src/modules/auth/domain/repositories/*.ts`
  - Notes: abstract classes only (Prisma impls land in T-006). No outward deps.
  - Covers AC3, AC4, AC8, AC9

- [x] T-004 domain: Ports `IOAuthProvider` (authorizeUrl/exchangeCode/fetchProfile) and
  `ITokenService` (issuePair/verifyAccess/verifyRefresh).
  - Files: `apps/api/src/modules/auth/domain/ports/*.ts`
  - Covers AC1, AC2, AC8

## Infrastructure

- [x] T-005 infrastructure: `JwtTokenService` implementing `ITokenService` + cookie
  helpers (set/clear `access_token` & `refresh_token`).
  - Files: `apps/api/src/modules/auth/infrastructure/token/jwt-token.service.ts`,
    `apps/api/src/modules/auth/infrastructure/http/cookie.helper.ts`
  - Notes: access ~15m, refresh ~7d; cookies `httpOnly; Secure; SameSite=Lax`; refresh
    persisted as SHA-256 hash.
  - Covers NFR (TTLs), security (cookie flags), AC8

- [x] T-006 infrastructure: Prisma repository implementations for the three repositories.
  - Files: `apps/api/src/modules/auth/infrastructure/persistence/prisma-*.repository.ts`
  - Covers AC3, AC4, AC8, AC9

- [x] T-007 infrastructure: `GoogleProvider` and `DiscordProvider` implementing
  `IOAuthProvider`, with signed single-use `state` generation/validation.
  - Files: `apps/api/src/modules/auth/infrastructure/providers/{google,discord}.provider.ts`,
    `apps/api/src/modules/auth/infrastructure/providers/state.ts`
  - Notes: Discord profile must surface `verified`; Google email verified by default.
  - Covers AC1, AC2, AC5 (state), AC4 (verified flag)

## Application (use cases)

- [x] T-008 application: `StartOAuth` use case — build provider authorize URL with backend
  `redirect_uri` and issue the `state` cookie.
  - Files: `apps/api/src/modules/auth/application/start-oauth.usecase.ts`
  - Covers AC1, AC2

- [x] T-009 application: `HandleOAuthCallback` use case — validate `state`, exchange `code`,
  enforce verified email, resolve account (find-account → link-by-email → create), issue
  token pair.
  - Files: `apps/api/src/modules/auth/application/handle-oauth-callback.usecase.ts`
  - Notes: invalid `code`/`state`/unverified ⇒ domain auth error (no session).
  - Covers AC3, AC4, AC5

- [x] T-010 application: `RefreshSession` use case — verify refresh, revoke old token row,
  issue rotated pair.
  - Files: `apps/api/src/modules/auth/application/refresh-session.usecase.ts`
  - Covers AC8

- [ ] T-011 application: `Logout` use case — revoke refresh token row (idempotent).
  - Files: `apps/api/src/modules/auth/application/logout.usecase.ts`
  - Covers AC9

## Presentation

- [ ] T-012 presentation: `JwtAuthGuard` (reads `access_token` cookie) + `@CurrentUser`
  decorator.
  - Files: `apps/api/src/modules/auth/presentation/guards/jwt-auth.guard.ts`,
    `apps/api/src/modules/auth/presentation/decorators/current-user.decorator.ts`
  - Covers AC6, AC7

- [ ] T-013 presentation: `AuthController` wiring all routes + the auth Nest module
  (DI bindings of ports → impls).
  - Files: `apps/api/src/modules/auth/presentation/auth.controller.ts`,
    `apps/api/src/modules/auth/auth.module.ts`
  - Routes: `GET /auth/:provider/start`, `GET /auth/:provider/callback`,
    `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
  - Notes: callback sets cookies + `302 /`; failure ⇒ `401` + `302 /login-error`;
    logout clears cookies.
  - Covers AC1, AC2, AC3, AC4, AC5, AC8, AC9

## Frontend (Atomic Design)

- [ ] T-014 web: atoms + molecule — `Button.atom.tsx`, `Spinner.atom.tsx`,
  `OAuthButton.molecule.tsx` (links to `/auth/:provider/start`).
  - Files: `apps/web/src/components/atoms/*`, `apps/web/src/components/molecules/o-auth-button.molecule.tsx`
  - Covers AC1, AC2

- [ ] T-015 web: organism — `LoginPanel.organism.tsx` (two OAuth buttons + error slot).
  - Files: `apps/web/src/components/organisms/login-panel.organism.tsx`
  - Covers AC1, AC2, AC5

- [ ] T-016 web: feature slice — TanStack routes `/login`, `/login-error`, protected-route
  guard; queries `useSession()` (`GET /auth/me`) and `useLogout()` mutation.
  - Files: `apps/web/src/features/auth/**`
  - Notes: guard 401-redirects to `/login`; no token touched by JS.
  - Covers AC5, AC6, AC7, AC9

## Acceptance test coverage map

> Every AC must have at least one passing test before its task is checked (testing.rule).

- AC1/AC2 → `StartOAuth` + provider unit tests; controller e2e on `/auth/:provider/start`.
- AC3 → `HandleOAuthCallback` create-path test (User+OAuthAccount, role member, cookies, 302 `/`).
- AC4 → callback link-by-verified-email test (no duplicate User).
- AC5 → callback bad `code`/`state`/unverified ⇒ 401 + `/login-error`.
- AC6/AC7 → `JwtAuthGuard` unit + protected-route e2e.
- AC8 → `RefreshSession` rotation test (valid → new+rotated; invalid → 401).
- AC9 → `Logout` test (cookies cleared; subsequent protected request → 401).

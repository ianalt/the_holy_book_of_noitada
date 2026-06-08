# Design: Auth

> The HOW. Must satisfy every acceptance criterion in requirements.md and obey
> constitution.md. Spend the strong model here.

> Greenfield: no existing `prisma/schema.prisma` or `apps/api` modules exist yet.
> This design introduces the first bounded context, `modules/auth/`.

## Data model (Prisma)

```prisma
// apps/api/prisma/schema.prisma

model User {
  id        String         @id @default(cuid())
  email     String         @unique          // verified email; identity key for linking (AC4)
  role      String         @default("member") // default role assigned on first login (AC3)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  accounts  OAuthAccount[]                   // 1 User : N OAuthAccounts (AC4)
}

model OAuthAccount {
  id             String   @id @default(cuid())
  provider       String                       // "google" | "discord"
  providerUserId String                       // the provider's stable subject id
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())

  @@unique([provider, providerUserId])        // one account per provider identity (AC3/AC4 idempotency)
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique                  // SHA-256 of the refresh JWT; never store raw token
  expiresAt DateTime                           // ~7 days (NFR)
  revokedAt DateTime?                          // set on rotation/logout (AC8/AC9)
  createdAt DateTime @default(now())

  @@index([userId])
}
```

Constraint → AC mapping:
- `User.email @unique` + `OAuthAccount @@unique([provider, providerUserId])` enforce
  "one account per person" and make linking deterministic → **AC3, AC4**.
- `User.role @default("member")` → **AC3**.
- `RefreshToken.tokenHash` + `revokedAt` support rotation and invalidation → **AC8, AC9**.

> `User` and `RefreshToken` declare a `@relation` to each other for referential integrity;
> only `OAuthAccount` is listed in the requirements, `RefreshToken` is an implementation
> detail of rotation (out-of-scope items unaffected).

## API contract

All cookies are `httpOnly; Secure; SameSite=Lax` (Lax so the OAuth redirect-back carries
them). Access cookie `access_token` TTL ~15m; refresh cookie `refresh_token` TTL ~7d.

| Method & path | Body / params | Success | Failure |
|---|---|---|---|
| `GET /auth/:provider/start` (`provider` ∈ google,discord) | — | `302` to provider consent screen w/ backend `redirect_uri` + signed `state` cookie | `404` unknown provider |
| `GET /auth/:provider/callback` | `?code&state` | `302 /`, sets `access_token` + `refresh_token` cookies | `302 /login-error` + `401` on bad/expired `code` or `state` mismatch |
| `POST /auth/refresh` | `refresh_token` cookie | `200`, new `access_token`, rotated `refresh_token` | `401` invalid/expired/revoked |
| `POST /auth/logout` | `refresh_token` cookie | `200`, clears both cookies, revokes refresh row | `200` (idempotent) |
| (guard) any protected route | `access_token` cookie | passes | `401` missing/invalid |

Path → AC mapping: `start` → **AC1, AC2**; `callback` → **AC3, AC4, AC5**;
guard → **AC6, AC7**; `refresh` → **AC8**; `logout` → **AC9**.

## Domain decisions

- **OAuth2 Authorization Code Flow, redirect URI on the backend** → AC1/AC2/AC3. The
  provider calls back to NestJS so the `code`→token exchange and cookie-setting happen
  server-side; the browser never sees tokens (security constraint).
- **`state` is a signed, single-use value** stored in a short-lived httpOnly cookie and
  compared on callback → AC5 + CSRF security constraint. Mismatch ⇒ 401 + `/login-error`.
- **Verified-email gate**: linking/creation proceeds only when the provider reports the
  email verified (Google: always; Discord: `verified === true`) → AC4 security constraint.
  Unverified ⇒ treated as auth failure (AC5 path).
- **Account resolution on callback** (use case `HandleOAuthCallback`):
  1. find `OAuthAccount` by `(provider, providerUserId)` → returning same-provider login;
  2. else find `User` by verified `email` → link new `OAuthAccount` (AC4, no duplicate User);
  3. else create `User` (role `member`) + `OAuthAccount` (AC3).
- **Tokens**: access = short-lived JWT (sub=userId, role); refresh = opaque-ish JWT whose
  SHA-256 is persisted. On `refresh`, verify → revoke old row → issue new pair (rotation) →
  AC8. On `logout`, revoke row + clear cookies → AC9.
- **Provider abstraction**: an `IOAuthProvider` strategy (authorizeUrl, exchangeCode,
  fetchProfile) with `GoogleProvider` / `DiscordProvider` infrastructure impls, so AC1/AC2
  share one flow.
- **Repositories** (Repository Pattern per constitution):
  - `UserRepository` (abstract) in `domain/` → `PrismaUserRepository` in `infrastructure/`.
  - `OAuthAccountRepository` (abstract) in `domain/` → Prisma impl in `infrastructure/`.
  - `RefreshTokenRepository` (abstract) in `domain/` → Prisma impl in `infrastructure/`.

### Backend layout (`apps/api/src/modules/auth/`)
- `domain/` — entities `User`, `OAuthAccount`; value objects `Email`, `Provider`;
  abstract repositories; `IOAuthProfile`, `ITokenPair` types.
- `application/` — use cases `StartOAuth`, `HandleOAuthCallback`, `RefreshSession`,
  `Logout`; `ITokenService` port.
- `infrastructure/` — Prisma repository impls, `GoogleProvider`/`DiscordProvider`,
  `JwtTokenService`, cookie helpers.
- `presentation/` — `AuthController`, `JwtAuthGuard` (reads `access_token` cookie → AC6/AC7),
  `@CurrentUser` decorator.

## Frontend (Atomic Design)

Auth is backend-cookie-driven; the frontend is thin (redirects + guarding).
- **atoms**: `Button.atom.tsx`, `Spinner.atom.tsx`.
- **molecules**: `OAuthButton.molecule.tsx` (provider icon + label, links to
  `/auth/:provider/start`).
- **organisms**: `LoginPanel.organism.tsx` (the two OAuth buttons + error slot).
- **feature slice** (`features/auth/`):
  - routes (TanStack Router): `/login`, `/login-error` (AC5 landing), and a
    `beforeLoad`/auth guard wrapping protected routes that 401-redirects to `/login`.
  - queries (TanStack Query): `useSession()` calling `GET /auth/me` (derives logged-in
    state from the httpOnly cookie; no token touched by JS — security constraint);
    `useLogout()` mutation → `POST /auth/logout` then redirect to `/login`.
  - successful login lands on `/` because the backend callback redirects there (AC3).

> No token is ever read/written by frontend JS or placed in localStorage/URL —
> the session is owned entirely by httpOnly cookies (security constraint).

## Traceability

- **AC1** → `GET /auth/google/start` + `GoogleProvider.authorizeUrl` + `StartOAuth`.
- **AC2** → `GET /auth/discord/start` + `DiscordProvider.authorizeUrl` + `StartOAuth`.
- **AC3** → `HandleOAuthCallback` create-path; `User.role @default("member")`; sets cookies; `302 /`.
- **AC4** → `HandleOAuthCallback` link-by-verified-email path; `User.email @unique`; new `OAuthAccount`.
- **AC5** → invalid `code`/`state` mismatch/unverified email ⇒ no cookies, `401`, `302 /login-error`.
- **AC6** → `JwtAuthGuard` rejects missing/invalid `access_token` ⇒ `401`.
- **AC7** → `JwtAuthGuard` accepts valid `access_token` ⇒ passes.
- **AC8** → `POST /auth/refresh`: `RefreshSession` verifies, revokes old `RefreshToken`, issues rotated pair; invalid ⇒ `401`.
- **AC9** → `POST /auth/logout`: revokes `RefreshToken`, clears cookies; next protected request ⇒ `401`.
- **NFR (TTLs/rotation)** → `JwtTokenService` access ~15m / refresh ~7d; rotation in `RefreshSession`.
- **Security (cookies/state/verified-email)** → cookie flags in `infrastructure/` helpers; signed `state`; verified-email gate in `HandleOAuthCallback`.

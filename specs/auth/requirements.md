# Feature: Auth

## Outcome
Members sign in with Google or Discord. The app issues an httpOnly session and
recognizes returning users across both providers (one account per person).

## In scope
- OAuth2 Authorization Code Flow for Google and Discord; redirect URIs target the
  NestJS backend.
- On a successful callback, issue access + refresh JWTs as httpOnly cookies.
- First login creates a User + an OAuthAccount and assigns the default role ("member").
- A returning login is matched by verified email and links the new provider to the
  existing User (1 User, N OAuthAccounts).
- A valid session is required on protected routes.
- Token refresh (with rotation) and logout.
- After a successful login, the user lands on the app home (`/`).

## Out of scope
- Email/password login, magic links, password reset (there are no passwords).
- Role management and the role matrix (handled by the `permissions` feature).
- Account unlinking / managing multiple emails.

## Acceptance criteria
- [ ] AC1: starting Google OAuth redirects to Google's consent screen with the backend redirect URI.
- [ ] AC2: starting Discord OAuth redirects to Discord's consent screen with the backend redirect URI.
- [ ] AC3: a valid Google callback for a new verified email → creates User + OAuthAccount(google), assigns the default role "member", sets httpOnly access+refresh cookies, redirects to `/`.
- [ ] AC4: a valid callback whose verified email matches an existing User → creates a new OAuthAccount linked to that User (no duplicate User), sets cookies.
- [ ] AC5: a callback with an invalid/expired authorization code → no session issued, returns 401, redirects to the login-error route.
- [ ] AC6: a request to a protected route without a valid access cookie → 401.
- [ ] AC7: a request to a protected route with a valid access cookie → passes the guard.
- [ ] AC8: refresh with a valid refresh cookie → issues a new access cookie and rotates the refresh token; with an invalid/expired refresh cookie → 401.
- [ ] AC9: logout → clears access + refresh cookies; a following protected request → 401.

## Non-functional constraints
- Access token TTL ~15 minutes; refresh token TTL ~7 days; refresh rotation on every use.

## Security constraints
- Tokens live ONLY in httpOnly, Secure, SameSite cookies — never readable by JS, never
  in localStorage or in a URL.
- The OAuth `state` parameter is validated on the callback (CSRF protection on the flow).
- Email linking (AC4) only when the provider reports the email as verified
  (Google verified by default; Discord `verified` flag must be true).
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export interface ICookieAttributes {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  /** Max-Age in seconds. */
  maxAge: number;
}

export interface ICookie {
  name: string;
  value: string;
  attributes: ICookieAttributes;
}

/**
 * Fixed security posture for auth cookies (security constraint): HttpOnly so JS
 * can never read the token, Secure, and SameSite=Lax so the cookie survives the
 * OAuth provider's redirect back to the app. `secure` is parameterized only so it
 * can be relaxed over plain http in local dev.
 */
function authCookieAttributes(secure: boolean, maxAge: number): ICookieAttributes {
  return { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge };
}

/** Builds a token-bearing cookie (AC3 login, AC8 refresh). */
export function buildAuthCookie(
  name: string,
  value: string,
  secure: boolean,
  maxAgeSeconds: number,
): ICookie {
  return { name, value, attributes: authCookieAttributes(secure, maxAgeSeconds) };
}

/** Builds an expired empty cookie that clears the named cookie (AC9 logout). */
export function buildClearCookie(name: string, secure: boolean): ICookie {
  return { name, value: "", attributes: authCookieAttributes(secure, 0) };
}

const SAME_SITE_LABEL: Record<ICookieAttributes["sameSite"], string> = {
  lax: "Lax",
  strict: "Strict",
  none: "None",
};

/** Serializes a cookie to a `Set-Cookie` header value. */
export function serializeCookie(cookie: ICookie): string {
  const { attributes: a } = cookie;
  const parts = [
    `${cookie.name}=${cookie.value}`,
    `Path=${a.path}`,
    `Max-Age=${a.maxAge}`,
    `SameSite=${SAME_SITE_LABEL[a.sameSite]}`,
  ];
  if (a.httpOnly) parts.push("HttpOnly");
  if (a.secure) parts.push("Secure");
  return parts.join("; ");
}

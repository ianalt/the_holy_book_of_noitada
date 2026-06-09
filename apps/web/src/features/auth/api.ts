export interface ICurrentUser {
  id: string;
  role: string;
}

/**
 * Fetches the current session principal. Relies entirely on the httpOnly cookie
 * (`credentials: "include"`) — JS never reads a token (security constraint).
 * Returns null when unauthenticated (401) so callers can treat it as "signed out"
 * (AC6); returns the principal on success (AC7).
 */
export async function fetchSession(baseUrl = ""): Promise<ICurrentUser | null> {
  const res = await fetch(`${baseUrl}/auth/me`, { credentials: "include" });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Session check failed (${res.status})`);
  }
  return (await res.json()) as ICurrentUser;
}

/** Ends the session server-side; the backend clears the auth cookies (AC9). */
export async function postLogout(baseUrl = ""): Promise<void> {
  const res = await fetch(`${baseUrl}/auth/logout`, { method: "POST", credentials: "include" });
  if (!res.ok) {
    throw new Error(`Logout failed (${res.status})`);
  }
}

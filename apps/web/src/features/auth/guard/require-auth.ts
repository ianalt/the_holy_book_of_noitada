import { redirect } from "@tanstack/react-router";
import { type ICurrentUser, fetchSession } from "../api";
import { AUTH_API_BASE_URL } from "../config";

export interface IRequireAuthDeps {
  /** Override the session source (used in tests). */
  getSession?: () => Promise<ICurrentUser | null>;
}

/**
 * Protected-route guard for a TanStack Router `beforeLoad`. When there is no valid
 * session (the backend returns 401 because the access cookie is missing/invalid),
 * it redirects to /login (AC6); otherwise it returns the principal (AC7).
 */
export async function requireAuth(deps: IRequireAuthDeps = {}): Promise<{ user: ICurrentUser }> {
  const getSession = deps.getSession ?? (() => fetchSession(AUTH_API_BASE_URL));
  const user = await getSession();
  if (!user) {
    throw redirect({ to: "/login" });
  }
  return { user };
}

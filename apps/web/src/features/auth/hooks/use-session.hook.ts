import { useQuery } from "@tanstack/react-query";
import { type ICurrentUser, fetchSession } from "../api";
import { AUTH_API_BASE_URL } from "../config";

export const SESSION_QUERY_KEY = ["auth", "session"] as const;

/**
 * Exposes the current session via TanStack Query (AC7). `data` is the principal
 * when signed in, or null when signed out — derived from the httpOnly cookie, so
 * no token is ever handled by JS.
 */
export function useSession(baseUrl: string = AUTH_API_BASE_URL) {
  return useQuery<ICurrentUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => fetchSession(baseUrl),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postLogout } from "../api";
import { AUTH_API_BASE_URL } from "../config";
import { SESSION_QUERY_KEY } from "./use-session.hook";

export interface IUseLogoutOptions {
  baseUrl?: string;
  /** Called after a successful logout — typically navigate to /login. */
  onSuccess?: () => void;
}

/**
 * Logout mutation (AC9): POST /auth/logout (backend clears cookies), then
 * invalidate the cached session so the app re-evaluates as signed out, and run
 * the caller's onSuccess (e.g. redirect to /login).
 */
export function useLogout(options: IUseLogoutOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postLogout(options.baseUrl ?? AUTH_API_BASE_URL),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      options.onSuccess?.();
    },
  });
}

import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { requireAuth } from "../guard/require-auth";
import { LoginErrorPage } from "./login-error.page";
import { LoginPage } from "./login.page";

export const LOGIN_PATH = "/login";
export const LOGIN_ERROR_PATH = "/login-error";

/**
 * `beforeLoad` handler for protected routes — redirects to /login when there is
 * no valid session (AC6), otherwise lets the route load with the principal (AC7).
 */
export function protectedBeforeLoad(): Promise<{ user: { id: string; role: string } }> {
  return requireAuth();
}

/**
 * Builds the auth feature routes against the application's root route
 * (TanStack Router). The app shell calls this and adds the result to its route
 * tree.
 */
export function createAuthRoutes(rootRoute: AnyRoute) {
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: LOGIN_PATH,
    component: LoginPage,
  });
  const loginErrorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: LOGIN_ERROR_PATH,
    component: LoginErrorPage,
  });
  return { loginRoute, loginErrorRoute };
}

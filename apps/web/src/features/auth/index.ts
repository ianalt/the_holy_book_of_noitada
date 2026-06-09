export { type ICurrentUser, fetchSession, postLogout } from "./api";
export { AUTH_API_BASE_URL } from "./config";
export { requireAuth } from "./guard/require-auth";
export { SESSION_QUERY_KEY, useSession } from "./hooks/use-session.hook";
export { type IUseLogoutOptions, useLogout } from "./hooks/use-logout.hook";
export { LoginPage } from "./routes/login.page";
export { DEFAULT_LOGIN_ERROR, LoginErrorPage } from "./routes/login-error.page";
export {
  LOGIN_ERROR_PATH,
  LOGIN_PATH,
  createAuthRoutes,
  protectedBeforeLoad,
} from "./routes/auth.routes";

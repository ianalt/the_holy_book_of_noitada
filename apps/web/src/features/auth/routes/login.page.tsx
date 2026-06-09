import { LoginPanel } from "../../../components/organisms/login-panel.organism";
import { AUTH_API_BASE_URL } from "../config";

/** `/login` route view — the sign-in panel (AC1, AC2). */
export function LoginPage() {
  return <LoginPanel apiBaseUrl={AUTH_API_BASE_URL} />;
}

import { LoginPanel } from "../../../components/organisms/login-panel.organism";
import { AUTH_API_BASE_URL } from "../config";

export const DEFAULT_LOGIN_ERROR = "We couldn't sign you in. Please try again.";

export interface ILoginErrorPageProps {
  message?: string;
}

/** `/login-error` route view — the sign-in panel with an error (AC5). */
export function LoginErrorPage({ message = DEFAULT_LOGIN_ERROR }: ILoginErrorPageProps) {
  return <LoginPanel apiBaseUrl={AUTH_API_BASE_URL} errorMessage={message} />;
}

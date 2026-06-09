import { OAuthButton } from "../molecules/o-auth-button.molecule";

export interface ILoginPanelProps {
  /** Error to surface, e.g. on the login-error route after a failed callback (AC5). */
  errorMessage?: string;
  /** Disables the provider buttons while a redirect is in flight. */
  isLoading?: boolean;
  /** Backend origin passed through to the provider buttons. */
  apiBaseUrl?: string;
  title?: string;
}

/**
 * The sign-in panel: a Google and a Discord login button (AC1, AC2) plus an
 * error slot used to show the reason a previous login failed (AC5).
 */
export function LoginPanel({
  errorMessage,
  isLoading = false,
  apiBaseUrl = "",
  title = "Sign in",
}: ILoginPanelProps) {
  return (
    <section aria-labelledby="login-panel-title" data-login-panel="">
      <h1 id="login-panel-title">{title}</h1>
      {errorMessage ? (
        <p role="alert" data-login-error="">
          {errorMessage}
        </p>
      ) : null}
      <OAuthButton provider="google" isLoading={isLoading} apiBaseUrl={apiBaseUrl} />
      <OAuthButton provider="discord" isLoading={isLoading} apiBaseUrl={apiBaseUrl} />
    </section>
  );
}

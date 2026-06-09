import { Spinner } from "../atoms/spinner.atom";

export type IOAuthProviderName = "google" | "discord";

export interface IOAuthButtonProps {
  provider: IOAuthProviderName;
  label?: string;
  isLoading?: boolean;
  /** Optional backend origin (e.g. http://localhost:3001); defaults to same origin. */
  apiBaseUrl?: string;
}

const PROVIDER_LABELS: Record<IOAuthProviderName, string> = {
  google: "Continue with Google",
  discord: "Continue with Discord",
};

/** Backend endpoint that starts the OAuth flow for a provider (AC1, AC2). */
export function oAuthStartHref(provider: IOAuthProviderName, apiBaseUrl = ""): string {
  return `${apiBaseUrl}/auth/${provider}/start`;
}

/**
 * A provider login button. It is a plain anchor (not a client-side router link)
 * so the browser does a full navigation to the backend start endpoint, which
 * begins the OAuth redirect (AC1 Google, AC2 Discord).
 */
export function OAuthButton({
  provider,
  label,
  isLoading = false,
  apiBaseUrl = "",
}: IOAuthButtonProps) {
  const text = label ?? PROVIDER_LABELS[provider];
  return (
    <a
      href={oAuthStartHref(provider, apiBaseUrl)}
      data-provider={provider}
      aria-label={text}
      aria-disabled={isLoading}
    >
      {isLoading ? <Spinner label={`Connecting to ${provider}…`} /> : <span>{text}</span>}
    </a>
  );
}

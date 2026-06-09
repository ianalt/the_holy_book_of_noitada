// @vitest-environment jsdom
// Task T-014: Button/Spinner atoms + OAuthButton molecule. Covers the frontend
// contribution to AC1/AC2: the provider button links (full navigation) to the
// backend's /auth/:provider/start endpoint that begins the OAuth flow.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  OAuthButton,
  oAuthStartHref,
} from "../../../apps/web/src/components/molecules/o-auth-button.molecule";

afterEach(cleanup);

describe("oAuthStartHref (AC1, AC2)", () => {
  it("targets the backend start endpoint per provider", () => {
    expect(oAuthStartHref("google")).toBe("/auth/google/start");
    expect(oAuthStartHref("discord")).toBe("/auth/discord/start");
  });

  it("prefixes the configured API base URL when provided", () => {
    expect(oAuthStartHref("google", "http://localhost:3001")).toBe(
      "http://localhost:3001/auth/google/start",
    );
  });
});

describe("OAuthButton (AC1, AC2)", () => {
  it("renders a link to Google's start endpoint", () => {
    render(<OAuthButton provider="google" />);
    const link = screen.getByRole("link", { name: /google/i });
    expect(link.getAttribute("href")).toBe("/auth/google/start");
  });

  it("renders a link to Discord's start endpoint, honouring the API base URL", () => {
    render(<OAuthButton provider="discord" apiBaseUrl="http://api.test" />);
    const link = screen.getByRole("link", { name: /discord/i });
    expect(link.getAttribute("href")).toBe("http://api.test/auth/discord/start");
  });

  it("shows a spinner while loading", () => {
    render(<OAuthButton provider="google" isLoading />);
    expect(screen.getByRole("status")).toBeDefined();
    // still a navigable link to the start endpoint
    expect(screen.getByRole("link").getAttribute("href")).toBe("/auth/google/start");
  });
});

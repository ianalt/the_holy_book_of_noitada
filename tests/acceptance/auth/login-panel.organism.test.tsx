// @vitest-environment jsdom
// Task T-015: LoginPanel organism. Covers AC1/AC2 (renders both provider login
// buttons linking to the backend start endpoints) and AC5 (shows an error message
// when a previous login failed, e.g. on the login-error route).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoginPanel } from "../../../apps/web/src/components/organisms/login-panel.organism";

afterEach(cleanup);

describe("LoginPanel (AC1, AC2)", () => {
  it("renders Google and Discord login links to the backend start endpoints", () => {
    render(<LoginPanel />);
    expect(screen.getByRole("link", { name: /google/i }).getAttribute("href")).toBe(
      "/auth/google/start",
    );
    expect(screen.getByRole("link", { name: /discord/i }).getAttribute("href")).toBe(
      "/auth/discord/start",
    );
  });

  it("passes the API base URL through to both buttons", () => {
    render(<LoginPanel apiBaseUrl="http://api.test" />);
    expect(screen.getByRole("link", { name: /google/i }).getAttribute("href")).toBe(
      "http://api.test/auth/google/start",
    );
    expect(screen.getByRole("link", { name: /discord/i }).getAttribute("href")).toBe(
      "http://api.test/auth/discord/start",
    );
  });
});

describe("LoginPanel error slot (AC5)", () => {
  it("shows an alert with the error message when provided", () => {
    render(<LoginPanel errorMessage="We couldn't sign you in. Please try again." />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("couldn't sign you in");
  });

  it("renders no alert when there is no error", () => {
    render(<LoginPanel />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

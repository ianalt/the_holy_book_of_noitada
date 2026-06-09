// @vitest-environment jsdom
// Task T-016: features/auth slice. Covers AC5 (login-error view shows the error),
// AC6 (no session -> guard redirects to /login; /auth/me 401 -> null), AC7 (valid
// session exposed) and AC9 (logout posts and clears the session). No token is ever
// read by JS — the API calls rely on the httpOnly cookie (credentials: include).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSession, postLogout } from "../../../apps/web/src/features/auth/api";
import { requireAuth } from "../../../apps/web/src/features/auth/guard/require-auth";
import { useLogout } from "../../../apps/web/src/features/auth/hooks/use-logout.hook";
import { useSession } from "../../../apps/web/src/features/auth/hooks/use-session.hook";
import { LoginErrorPage } from "../../../apps/web/src/features/auth/routes/login-error.page";
import { LoginPage } from "../../../apps/web/src/features/auth/routes/login.page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(data) } as unknown as Response;
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("auth api (AC6, AC7, AC9)", () => {
  it("AC7: fetchSession returns the principal on 200, sending the cookie only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "u1", role: "member" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchSession()).resolves.toEqual({ id: "u1", role: "member" });
    expect(fetchMock).toHaveBeenCalledWith("/auth/me", { credentials: "include" });
  });

  it("AC6: fetchSession returns null on 401 (signed out)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 401)));
    await expect(fetchSession()).resolves.toBeNull();
  });

  it("fetchSession throws on unexpected errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 500)));
    await expect(fetchSession()).rejects.toThrow();
  });

  it("AC9: postLogout POSTs to /auth/logout with credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(postLogout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });
});

describe("requireAuth guard (AC6, AC7)", () => {
  it("AC6: redirects to /login when there is no session", async () => {
    let thrown: unknown;
    try {
      await requireAuth({ getSession: () => Promise.resolve(null) });
    } catch (error) {
      thrown = error;
    }
    expect(isRedirect(thrown)).toBe(true);
    const target = thrown as { to?: string; options?: { to?: string } };
    expect(target.to ?? target.options?.to).toBe("/login");
  });

  it("AC7: returns the principal when authenticated", async () => {
    await expect(
      requireAuth({ getSession: () => Promise.resolve({ id: "u1", role: "member" }) }),
    ).resolves.toEqual({ user: { id: "u1", role: "member" } });
  });
});

describe("auth views (AC5, AC1/AC2)", () => {
  it("AC5: LoginErrorPage surfaces an error alert", () => {
    render(<LoginErrorPage />);
    expect(screen.getByRole("alert").textContent).toContain("couldn't sign you in");
  });

  it("LoginPage renders both provider login links", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /google/i }).getAttribute("href")).toBe(
      "/auth/google/start",
    );
    expect(screen.getByRole("link", { name: /discord/i }).getAttribute("href")).toBe(
      "/auth/discord/start",
    );
  });
});

describe("auth query hooks (AC7, AC9)", () => {
  it("AC7: useSession exposes the principal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ id: "u1", role: "member" })));
    const { result } = renderHook(() => useSession(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "u1", role: "member" });
  });

  it("AC9: useLogout posts logout and runs onSuccess", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useLogout({ onSuccess }), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(fetchMock).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});

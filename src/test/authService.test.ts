import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/authService";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, getAuthToken } from "@/services/api";

describe("authService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("isLoggedIn strictly rejects missing or mock demo tokens", () => {
    expect(authService.isLoggedIn()).toBe(false);

    localStorage.setItem(AUTH_TOKEN_KEY, "demo");
    expect(authService.isLoggedIn()).toBe(false);

    localStorage.setItem(AUTH_TOKEN_KEY, "   ");
    expect(authService.isLoggedIn()).toBe(false);

    localStorage.setItem(AUTH_TOKEN_KEY, "real-token-401f7a");
    expect(authService.isLoggedIn()).toBe(true);
  });

  it("login calls Django login endpoint and stores token and mapped user", async () => {
    const mockResponse = {
      token: "drf-token-998877",
      user: {
        id: 1,
        username: "admin_user",
        email: "admin@example.com",
        is_staff: true,
        is_superuser: false,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = await authService.login("admin_user", "secure_pass_123");

    expect(user).toEqual({
      id: 1,
      username: "admin_user",
      email: "admin@example.com",
      isStaff: true,
      isSuperuser: false,
    });

    expect(getAuthToken()).toBe("drf-token-998877");
    expect(authService.getStoredUser()).toEqual(user);
    expect(authService.isLoggedIn()).toBe(true);

    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(callArgs[0]).toMatch(/\/api\/auth\/login\/$/);
    expect(callArgs[1].body).toBe(
      JSON.stringify({ username: "admin_user", password: "secure_pass_123" }),
    );
  });

  it("getCurrentUser retrieves verified user and refreshes stored user", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "drf-token-998877");

    const mockUser = {
      id: 2,
      username: "verified_user",
      email: "user@example.com",
      is_staff: true,
      is_superuser: true,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockUser,
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = await authService.getCurrentUser();
    expect(user.id).toBe(2);
    expect(user.isStaff).toBe(true);
    expect(user.isSuperuser).toBe(true);
    expect(authService.getStoredUser()?.username).toBe("verified_user");
  });

  it("logout notifies backend and clears stored token and user", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "drf-token-998877");
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: 1, username: "admin" }));
    localStorage.setItem("dwc_session", "demo");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ detail: "Successfully logged out." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await authService.logout();

    expect(getAuthToken()).toBeNull();
    expect(authService.getStoredUser()).toBeNull();
    expect(localStorage.getItem("dwc_session")).toBeNull();
    expect(authService.isLoggedIn()).toBe(false);

    const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(callArgs[0]).toMatch(/\/api\/auth\/logout\/$/);
  });
});

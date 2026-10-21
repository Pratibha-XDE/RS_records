import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiClient,
  apiRequest,
  clearAuthToken,
  getAuthToken,
  parseDrfError,
  setAuthToken,
  ApiError,
  AUTH_TOKEN_KEY,
} from "@/services/api";

describe("Centralized API client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("DRF error parser", () => {
    it("extracts detail message from DRF object", () => {
      const err = parseDrfError({ detail: "Invalid credentials provided." });
      expect(err.message).toBe("Invalid credentials provided.");
    });

    it("formats non_field_errors array", () => {
      const err = parseDrfError({
        non_field_errors: ["Unable to log in with provided credentials."],
      });
      expect(err.message).toBe("Unable to log in with provided credentials.");
    });

    it("formats field-level validation errors", () => {
      const err = parseDrfError({
        username: ["This field may not be blank."],
        password: ["This field is required."],
      });
      expect(err.message).toContain("username: This field may not be blank.");
      expect(err.message).toContain("password: This field is required.");
      expect(err.fieldErrors?.["username"]).toEqual(["This field may not be blank."]);
    });

    it("falls back to default message if invalid payload", () => {
      const err = parseDrfError(null, "Default error");
      expect(err.message).toBe("Default error");
    });
  });

  describe("Authentication token management", () => {
    it("stores and retrieves token in localStorage", () => {
      expect(getAuthToken()).toBeNull();
      setAuthToken("sample-token-123");
      expect(getAuthToken()).toBe("sample-token-123");
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe("sample-token-123");

      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });
  });

  describe("apiRequest fetch handling", () => {
    it("attaches Token authorization header when token exists", async () => {
      setAuthToken("secret-token-xyz");

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await apiRequest<{ success: boolean }>("/api/employees/");
      expect(res).toEqual({ success: true });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toMatch(/\/api\/employees\/$/);
      expect((callArgs[1].headers as Record<string, string>)["Authorization"]).toBe(
        "Token secret-token-xyz",
      );
    });

    it("does not attach Authorization header when skipAuth is true", async () => {
      setAuthToken("secret-token-xyz");

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ token: "new-token" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await apiRequest("/api/auth/login/", { skipAuth: true });

      const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((callArgs[1].headers as Record<string, string>)["Authorization"]).toBeUndefined();
    });

    it("clears token on 401 response and throws ApiError", async () => {
      setAuthToken("expired-token");

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ detail: "Invalid token." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(apiRequest("/api/auth/me/")).rejects.toThrow(ApiError);
      expect(getAuthToken()).toBeNull();
    });

    it("handles 403 Forbidden with descriptive message without wiping auth state", async () => {
      setAuthToken("staff-token");

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          detail: "Administrator access required. Only staff accounts may log in.",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      let caughtError: ApiError | null = null;
      try {
        await apiRequest("/api/auth/login/", { skipAuth: true });
      } catch (err) {
        if (err instanceof ApiError) caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.status).toBe(403);
      expect(caughtError?.message).toBe(
        "Administrator access required. Only staff accounts may log in.",
      );
      // skipAuth did not wipe token
      expect(getAuthToken()).toBe("staff-token");
    });

    it("returns null on 204 No Content response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await apiClient.delete("/api/work-records/1/");
      expect(res).toBeNull();
    });
  });
});

/**
 * Authentication service integrated with Django REST Framework backend.
 * Uses DRF token-based authentication via /api/auth/login/, /api/auth/logout/, and /api/auth/me/.
 */

import { apiClient, clearAuthToken, getAuthToken, setAuthToken, AUTH_USER_KEY } from "./api";
import type { AuthUser, BackendUser, DjangoLoginResponse } from "@/types";
import { mapDjangoUserToAuthUser } from "@/types";

export const authService = {
  /**
   * Authenticate with the Django REST Framework login endpoint.
   * On success, stores the auth token and authenticated user profile.
   */
  async login(username: string, password: string): Promise<AuthUser> {
    const data = await apiClient.post<DjangoLoginResponse>(
      "/api/auth/login/",
      { username, password },
      { skipAuth: true },
    );

    setAuthToken(data.token);
    const user = mapDjangoUserToAuthUser(data.user);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    return user;
  },

  /**
   * Log out the current user, revoking the token on the backend and clearing local storage.
   */
  async logout(): Promise<void> {
    try {
      if (this.isLoggedIn()) {
        await apiClient.post("/api/auth/logout/");
      }
    } catch {
      // Regardless of network errors, local authentication state must be completely cleared
    } finally {
      clearAuthToken();
    }
  },

  /**
   * Verify authentication and retrieve current user details from /api/auth/me/.
   */
  async getCurrentUser(): Promise<AuthUser> {
    const data = await apiClient.get<BackendUser>("/api/auth/me/");
    const user = mapDjangoUserToAuthUser(data);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    return user;
  },

  /**
   * Return cached authenticated user from local storage without making a network request.
   */
  getStoredUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  /**
   * Check if a valid auth token is stored. Strictly rejects empty strings or mock 'demo' tokens.
   */
  isLoggedIn(): boolean {
    const token = getAuthToken();
    return Boolean(token && token.trim() && token !== "demo");
  },
};
